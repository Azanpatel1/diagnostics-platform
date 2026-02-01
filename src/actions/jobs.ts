"use server";

import { db } from "@/db";
import { jobs, rawArtifacts, samples, sampleFeatures, featureSets } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { extractTimeseriesCSV, extractEndpointJSON } from "@/lib/extractors";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Lazy-initialized S3 client
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3Client;
}

export interface JobWithDetails {
  id: string;
  type: string;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  artifactFileName?: string;
  sampleLabel?: string;
}

export async function listAllJobs(): Promise<{
  success: boolean;
  data?: JobWithDetails[];
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return { success: false, error: "Unauthorized" };
    }

    const { orgId } = authContext;
    if (!orgId) {
      return { success: false, error: "No organization selected" };
    }

    const result = await db
      .select()
      .from(jobs)
      .where(eq(jobs.orgId, orgId))
      .orderBy(desc(jobs.createdAt))
      .limit(100);

    // Enrich with artifact and sample info
    const enrichedJobs = await Promise.all(
      result.map(async (job) => {
        let artifactFileName: string | undefined;
        let sampleLabel: string | undefined;

        const input = job.input as Record<string, unknown> | null;
        const artifactId = input?.artifact_id as string | undefined;

        if (artifactId) {
          const [artifact] = await db
            .select({
              fileName: rawArtifacts.fileName,
              sampleId: rawArtifacts.sampleId,
            })
            .from(rawArtifacts)
            .where(and(eq(rawArtifacts.id, artifactId), eq(rawArtifacts.orgId, orgId)));

          if (artifact) {
            artifactFileName = artifact.fileName;

            if (artifact.sampleId) {
              const [sample] = await db
                .select({ label: samples.sampleLabel })
                .from(samples)
                .where(and(eq(samples.id, artifact.sampleId), eq(samples.orgId, orgId)));

              if (sample) {
                sampleLabel = sample.label || undefined;
              }
            }
          }
        }

        return {
          id: job.id,
          type: job.type,
          status: job.status,
          input: input,
          output: job.output as Record<string, unknown> | null,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          artifactFileName,
          sampleLabel,
        };
      })
    );

    return { success: true, data: enrichedJobs };
  } catch (error) {
    console.error("Error listing jobs:", error);
    return { success: false, error: "Failed to list jobs" };
  }
}

export async function enqueueExtractFeatures(artifactId: string): Promise<{
  success: boolean;
  data?: { jobId: string; featuresCount?: number };
  error?: string;
}> {
  const jobId = uuidv4();
  let orgId: string | null = null;

  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return { success: false, error: "Unauthorized" };
    }

    orgId = authContext.orgId;
    if (!orgId) {
      return { success: false, error: "No organization selected" };
    }

    // Verify artifact exists and belongs to org
    const artifact = await db.query.rawArtifacts.findFirst({
      where: and(eq(rawArtifacts.id, artifactId), eq(rawArtifacts.orgId, orgId)),
    });

    if (!artifact) {
      return { success: false, error: "Artifact not found" };
    }

    // Check schema version is supported
    const schemaVersion = artifact.schemaVersion || "v1";
    if (!["v1_timeseries_csv", "v1_endpoint_json"].includes(schemaVersion)) {
      return { success: false, error: `Unsupported schema version: ${schemaVersion}` };
    }

    // Create job record (status: running)
    await db.insert(jobs).values({
      id: jobId,
      orgId,
      type: "extract_features",
      status: "running",
      input: {
        artifact_id: artifactId,
        feature_set: "core_v1",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Download file from S3
    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: artifact.storageKey,
    });

    const s3Response = await s3Client.send(command);
    const fileContent = await s3Response.Body?.transformToString();

    if (!fileContent) {
      throw new Error("Failed to download file from S3");
    }

    // Extract features based on schema
    let extractionResult;
    if (schemaVersion === "v1_timeseries_csv") {
      extractionResult = extractTimeseriesCSV(fileContent);
    } else {
      extractionResult = extractEndpointJSON(fileContent);
    }

    if (!extractionResult.success) {
      // Update job as failed
      await db
        .update(jobs)
        .set({
          status: "failed",
          error: extractionResult.error,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      return { success: false, data: { jobId }, error: extractionResult.error };
    }

    // Get or create feature set
    let featureSet = await db.query.featureSets.findFirst({
      where: and(eq(featureSets.orgId, orgId), eq(featureSets.name, "core_v1")),
    });

    if (!featureSet) {
      const [newFeatureSet] = await db
        .insert(featureSets)
        .values({
          orgId,
          name: "core_v1",
          version: "1.0.0",
          featureList: {
            timeseries: [
              "baseline_mean", "baseline_std", "y_max", "y_min",
              "t_at_max", "auc", "slope_early", "t_halfmax", "snr"
            ],
            endpoint: ["endpoint_value"],
            global: ["num_channels", "signal_quality_flag"],
          },
        })
        .returning();
      featureSet = newFeatureSet;
    }

    // Get sample ID from artifact
    let sampleId = artifact.sampleId;

    // If no sample linked, try to find one from the experiment
    if (!sampleId && artifact.experimentId) {
      const sample = await db.query.samples.findFirst({
        where: and(
          eq(samples.experimentId, artifact.experimentId),
          eq(samples.orgId, orgId)
        ),
      });
      sampleId = sample?.id || null;
    }

    // If still no sample, create one
    if (!sampleId && artifact.experimentId) {
      const [newSample] = await db
        .insert(samples)
        .values({
          orgId,
          experimentId: artifact.experimentId,
          sampleLabel: `Sample-${Date.now()}`,
        })
        .returning();
      sampleId = newSample.id;

      // Update artifact with sample ID
      await db
        .update(rawArtifacts)
        .set({ sampleId })
        .where(eq(rawArtifacts.id, artifactId));
    }

    if (!sampleId) {
      throw new Error("Could not determine sample for features");
    }

    // Upsert sample features
    const existingFeature = await db.query.sampleFeatures.findFirst({
      where: and(
        eq(sampleFeatures.sampleId, sampleId),
        eq(sampleFeatures.featureSetId, featureSet.id)
      ),
    });

    let sampleFeatureId: string;

    if (existingFeature) {
      // Update existing
      await db
        .update(sampleFeatures)
        .set({
          features: extractionResult.features,
          artifactId,
          computedAt: new Date(),
        })
        .where(eq(sampleFeatures.id, existingFeature.id));
      sampleFeatureId = existingFeature.id;
    } else {
      // Insert new
      const [newFeature] = await db
        .insert(sampleFeatures)
        .values({
          orgId,
          sampleId,
          featureSetId: featureSet.id,
          artifactId,
          features: extractionResult.features,
          computedAt: new Date(),
        })
        .returning();
      sampleFeatureId = newFeature.id;
    }

    // Update job as succeeded
    const featuresCount = Object.keys(extractionResult.features || {}).length;
    await db
      .update(jobs)
      .set({
        status: "succeeded",
        output: {
          features_count: featuresCount,
          sample_feature_id: sampleFeatureId,
        },
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    return { success: true, data: { jobId, featuresCount } };
  } catch (error) {
    console.error("Error extracting features:", error);

    // Update job as failed if we have an orgId
    if (orgId) {
      try {
        await db
          .update(jobs)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobId));
      } catch {
        // Ignore update errors
      }
    }

    return { 
      success: false, 
      data: { jobId },
      error: error instanceof Error ? error.message : "Failed to extract features" 
    };
  }
}

export async function getJob(jobId: string): Promise<{
  success: boolean;
  data?: JobWithDetails;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return { success: false, error: "Unauthorized" };
    }

    const { orgId } = authContext;
    if (!orgId) {
      return { success: false, error: "No organization selected" };
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    return {
      success: true,
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        input: job.input as Record<string, unknown> | null,
        output: job.output as Record<string, unknown> | null,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    };
  } catch (error) {
    console.error("Error getting job:", error);
    return { success: false, error: "Failed to get job" };
  }
}

export async function listJobsForArtifact(artifactId: string): Promise<{
  success: boolean;
  data?: JobWithDetails[];
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return { success: false, error: "Unauthorized" };
    }

    const { orgId } = authContext;
    if (!orgId) {
      return { success: false, error: "No organization selected" };
    }

    // Get all jobs and filter by artifact_id in input
    const allJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.orgId, orgId))
      .orderBy(desc(jobs.createdAt));

    const filtered = allJobs.filter((job) => {
      const input = job.input as Record<string, unknown> | null;
      return input?.artifact_id === artifactId;
    });

    return {
      success: true,
      data: filtered.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        input: job.input as Record<string, unknown> | null,
        output: job.output as Record<string, unknown> | null,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Error listing jobs for artifact:", error);
    return { success: false, error: "Failed to list jobs" };
  }
}

export async function getLatestJobForArtifact(artifactId: string): Promise<{
  success: boolean;
  data?: JobWithDetails;
  error?: string;
}> {
  try {
    const result = await listJobsForArtifact(artifactId);
    if (!result.success || !result.data || result.data.length === 0) {
      return { success: true, data: undefined };
    }

    return { success: true, data: result.data[0] };
  } catch (error) {
    console.error("Error getting latest job:", error);
    return { success: false, error: "Failed to get latest job" };
  }
}

export async function listJobsForSample(sampleId: string): Promise<{
  success: boolean;
  jobs: JobWithDetails[];
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return { success: false, jobs: [], error: "Unauthorized" };
    }

    const { orgId } = authContext;
    if (!orgId) {
      return { success: false, jobs: [], error: "No organization selected" };
    }

    // Get artifacts for this sample
    const sampleArtifacts = await db
      .select({ id: rawArtifacts.id })
      .from(rawArtifacts)
      .where(and(eq(rawArtifacts.sampleId, sampleId), eq(rawArtifacts.orgId, orgId)));

    const artifactIds = sampleArtifacts.map((a) => a.id);

    if (artifactIds.length === 0) {
      return { success: true, jobs: [] };
    }

    // Get all jobs for this org and filter by artifact_id in input
    const allJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.orgId, orgId))
      .orderBy(desc(jobs.createdAt));

    const filtered = allJobs.filter((job) => {
      const input = job.input as Record<string, unknown> | null;
      return input?.artifact_id && artifactIds.includes(input.artifact_id as string);
    });

    return {
      success: true,
      jobs: filtered.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        input: job.input as Record<string, unknown> | null,
        output: job.output as Record<string, unknown> | null,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Error listing jobs for sample:", error);
    return { success: false, jobs: [], error: "Failed to list jobs" };
  }
}
