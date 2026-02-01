"use server";

import { db } from "@/db";
import { jobs, rawArtifacts, samples } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { enqueueJob, type JobPayload } from "@/lib/redis";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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
  data?: { jobId: string };
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

    // Verify artifact exists and belongs to org
    const [artifact] = await db
      .select()
      .from(rawArtifacts)
      .where(and(eq(rawArtifacts.id, artifactId), eq(rawArtifacts.orgId, orgId)));

    if (!artifact) {
      return { success: false, error: "Artifact not found" };
    }

    const jobId = uuidv4();

    // Create job record
    await db.insert(jobs).values({
      id: jobId,
      orgId,
      type: "extract_features",
      status: "queued",
      input: {
        artifact_id: artifactId,
        feature_set: "core_v1",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Enqueue to Redis
    const payload: JobPayload = {
      job_id: jobId,
      type: "extract_features",
      org_id: orgId,
      artifact_id: artifactId,
      feature_set: "core_v1",
    };

    await enqueueJob(payload);

    return { success: true, data: { jobId } };
  } catch (error) {
    console.error("Error enqueueing extraction:", error);
    return { success: false, error: "Failed to enqueue extraction" };
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
