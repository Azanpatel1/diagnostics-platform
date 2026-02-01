import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import { 
  rawArtifacts, 
  samples, 
  jobs, 
  sampleFeatures, 
  featureSets, 
  orgs 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { extractTimeseriesCSV, extractEndpointJSON } from "@/lib/extractors";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

export async function POST(request: NextRequest) {
  const jobId = uuidv4();
  let orgId: string | null = null;

  try {
    const { userId, orgId: clerkOrgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get clerkOrgId from header if not in auth
    const headerOrgId = request.headers.get("x-clerk-org-id");
    const effectiveOrgId = clerkOrgId || headerOrgId;

    if (!effectiveOrgId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      );
    }

    // Get internal org ID
    const org = await db.query.orgs.findFirst({
      where: eq(orgs.clerkOrgId, effectiveOrgId),
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    orgId = org.id;

    // Parse request body
    const body = await request.json();
    const { artifactId } = body;

    if (!artifactId) {
      return NextResponse.json(
        { error: "Missing artifactId" },
        { status: 400 }
      );
    }

    // Get artifact
    const artifact = await db.query.rawArtifacts.findFirst({
      where: and(
        eq(rawArtifacts.id, artifactId),
        eq(rawArtifacts.orgId, orgId)
      ),
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    // Check schema version is supported
    const schemaVersion = artifact.schemaVersion || "v1";
    if (!["v1_timeseries_csv", "v1_endpoint_json"].includes(schemaVersion)) {
      return NextResponse.json(
        { error: `Unsupported schema version: ${schemaVersion}` },
        { status: 400 }
      );
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
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
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

      return NextResponse.json({
        success: false,
        jobId,
        error: extractionResult.error,
      });
    }

    // Get or create feature set
    let featureSet = await db.query.featureSets.findFirst({
      where: and(
        eq(featureSets.orgId, orgId),
        eq(featureSets.name, "core_v1")
      ),
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
    const featureCount = Object.keys(extractionResult.features || {}).length;
    await db
      .update(jobs)
      .set({
        status: "succeeded",
        output: {
          features_count: featureCount,
          sample_feature_id: sampleFeatureId,
        },
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    return NextResponse.json({
      success: true,
      jobId,
      data: {
        featuresCount: featureCount,
        sampleFeatureId,
      },
    });
  } catch (error) {
    console.error("Extraction error:", error);

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

    return NextResponse.json(
      { 
        success: false,
        jobId,
        error: error instanceof Error ? error.message : "Extraction failed" 
      },
      { status: 500 }
    );
  }
}
