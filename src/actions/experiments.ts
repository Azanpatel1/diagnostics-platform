"use server";

import { revalidatePath } from "next/cache";
import { db, experiments, samples, rawArtifacts } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext, getAuthContextWithOrgId, AuthError } from "@/lib/auth";
import {
  createExperimentSchema,
  CreateExperimentInput,
} from "@/lib/validations";

export type ExperimentWithCounts = {
  id: string;
  orgId: string;
  name: string;
  protocolVersion: string | null;
  instrumentId: string | null;
  operator: string | null;
  notes: string | null;
  startedAt: Date | null;
  createdAt: Date;
  sampleCount: number;
  artifactCount: number;
};

export type ExperimentDetail = {
  id: string;
  orgId: string;
  name: string;
  protocolVersion: string | null;
  instrumentId: string | null;
  operator: string | null;
  notes: string | null;
  startedAt: Date | null;
  createdAt: Date;
  samples: {
    id: string;
    sampleLabel: string;
    patientPseudonym: string | null;
    matrixType: string | null;
    collectedAt: Date | null;
    createdAt: Date;
    artifactCount: number;
  }[];
  artifacts: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: string | null;
    sha256: string;
    schemaVersion: string;
    createdAt: Date;
    sampleId: string | null;
    sampleLabel: string | null;
  }[];
};

/**
 * Create a new experiment for the current organization
 */
export async function createExperiment(
  input: CreateExperimentInput,
  clerkOrgId?: string
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    // Use client-provided orgId if available (workaround for Clerk session sync issues)
    const { orgId } = clerkOrgId 
      ? await getAuthContextWithOrgId(clerkOrgId)
      : await getAuthContext();

    // Validate input
    const validatedData = createExperimentSchema.parse(input);

    // Create the experiment
    const [experiment] = await db
      .insert(experiments)
      .values({
        orgId,
        name: validatedData.name,
        protocolVersion: validatedData.protocolVersion || null,
        instrumentId: validatedData.instrumentId || null,
        operator: validatedData.operator || null,
        notes: validatedData.notes || null,
        startedAt: validatedData.startedAt
          ? new Date(validatedData.startedAt)
          : null,
      })
      .returning({ id: experiments.id });

    revalidatePath("/experiments");

    return { success: true, data: { id: experiment.id } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error creating experiment:", error);
    return { success: false, error: "Failed to create experiment" };
  }
}

/**
 * List all experiments for the current organization
 */
export async function listExperiments(clerkOrgId?: string): Promise<{
  success: boolean;
  data?: ExperimentWithCounts[];
  error?: string;
}> {
  try {
    const { orgId } = clerkOrgId 
      ? await getAuthContextWithOrgId(clerkOrgId)
      : await getAuthContext();

    // Get experiments with sample and artifact counts
    const experimentsList = await db.query.experiments.findMany({
      where: eq(experiments.orgId, orgId),
      orderBy: desc(experiments.createdAt),
      with: {
        samples: {
          columns: { id: true },
        },
        artifacts: {
          columns: { id: true },
        },
      },
    });

    const result: ExperimentWithCounts[] = experimentsList.map((exp) => ({
      id: exp.id,
      orgId: exp.orgId,
      name: exp.name,
      protocolVersion: exp.protocolVersion,
      instrumentId: exp.instrumentId,
      operator: exp.operator,
      notes: exp.notes,
      startedAt: exp.startedAt,
      createdAt: exp.createdAt,
      sampleCount: exp.samples.length,
      artifactCount: exp.artifacts.length,
    }));

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error listing experiments:", error);
    return { success: false, error: "Failed to list experiments" };
  }
}

/**
 * Get a single experiment with its samples and artifacts
 * Verifies org ownership before returning data
 */
export async function getExperiment(
  experimentId: string,
  clerkOrgId?: string
): Promise<{ success: boolean; data?: ExperimentDetail; error?: string }> {
  try {
    const { orgId } = clerkOrgId 
      ? await getAuthContextWithOrgId(clerkOrgId)
      : await getAuthContext();

    // Get experiment with org verification
    const experiment = await db.query.experiments.findFirst({
      where: and(
        eq(experiments.id, experimentId),
        eq(experiments.orgId, orgId) // Critical: verify org ownership
      ),
      with: {
        samples: {
          orderBy: desc(samples.createdAt),
          with: {
            artifacts: {
              columns: { id: true },
            },
          },
        },
        artifacts: {
          orderBy: desc(rawArtifacts.createdAt),
          with: {
            sample: {
              columns: { sampleLabel: true },
            },
          },
        },
      },
    });

    if (!experiment) {
      return { success: false, error: "Experiment not found" };
    }

    const result: ExperimentDetail = {
      id: experiment.id,
      orgId: experiment.orgId,
      name: experiment.name,
      protocolVersion: experiment.protocolVersion,
      instrumentId: experiment.instrumentId,
      operator: experiment.operator,
      notes: experiment.notes,
      startedAt: experiment.startedAt,
      createdAt: experiment.createdAt,
      samples: experiment.samples.map((s) => ({
        id: s.id,
        sampleLabel: s.sampleLabel,
        patientPseudonym: s.patientPseudonym,
        matrixType: s.matrixType,
        collectedAt: s.collectedAt,
        createdAt: s.createdAt,
        artifactCount: s.artifacts.length,
      })),
      artifacts: experiment.artifacts.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize,
        sha256: a.sha256,
        schemaVersion: a.schemaVersion,
        createdAt: a.createdAt,
        sampleId: a.sampleId,
        sampleLabel: a.sample?.sampleLabel || null,
      })),
    };

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error getting experiment:", error);
    return { success: false, error: "Failed to get experiment" };
  }
}

/**
 * Delete an experiment and all associated data
 * Verifies org ownership before deletion
 */
export async function deleteExperiment(
  experimentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await getAuthContext();

    // Verify ownership and delete
    const result = await db
      .delete(experiments)
      .where(
        and(
          eq(experiments.id, experimentId),
          eq(experiments.orgId, orgId) // Critical: verify org ownership
        )
      )
      .returning({ id: experiments.id });

    if (result.length === 0) {
      return { success: false, error: "Experiment not found" };
    }

    revalidatePath("/experiments");

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error deleting experiment:", error);
    return { success: false, error: "Failed to delete experiment" };
  }
}
