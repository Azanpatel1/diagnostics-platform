"use server";

import { revalidatePath } from "next/cache";
import { db, rawArtifacts, experiments, samples } from "@/db";
import { eq, and } from "drizzle-orm";
import { getAuthContext, getAuthContextWithOrgId, AuthError } from "@/lib/auth";
import {
  registerArtifactSchema,
  RegisterArtifactInput,
  getUploadUrlSchema,
  GetUploadUrlInput,
} from "@/lib/validations";
import {
  generateStorageKey,
  generateUploadUrl,
  generateDownloadUrl,
  validateStorageKeyOwnership,
} from "@/lib/s3";

/**
 * Get a presigned URL for uploading a file
 * Returns the URL and the storage key to use for registration
 */
export async function getUploadUrl(
  input: GetUploadUrlInput,
  clerkOrgId?: string
): Promise<{
  success: boolean;
  data?: { uploadUrl: string; storageKey: string };
  error?: string;
}> {
  try {
    const { orgId } = clerkOrgId 
      ? await getAuthContextWithOrgId(clerkOrgId)
      : await getAuthContext();

    // Validate input
    const validatedData = getUploadUrlSchema.parse(input);

    // Verify the experiment belongs to this org
    const experiment = await db.query.experiments.findFirst({
      where: and(
        eq(experiments.id, validatedData.experimentId),
        eq(experiments.orgId, orgId) // Critical: verify org ownership
      ),
    });

    if (!experiment) {
      return {
        success: false,
        error: "Experiment not found or access denied",
      };
    }

    // Generate storage key with org prefix for isolation
    const storageKey = generateStorageKey(
      orgId,
      validatedData.experimentId,
      validatedData.fileName
    );

    // Generate presigned URL
    const { uploadUrl } = await generateUploadUrl(
      storageKey,
      validatedData.contentType
    );

    return {
      success: true,
      data: { uploadUrl, storageKey },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error generating upload URL:", error);
    return { success: false, error: "Failed to generate upload URL" };
  }
}

/**
 * Register an artifact after successful upload
 * Verifies org ownership and storage key validity
 */
export async function registerArtifact(
  input: RegisterArtifactInput,
  clerkOrgId?: string
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const { orgId } = clerkOrgId 
      ? await getAuthContextWithOrgId(clerkOrgId)
      : await getAuthContext();

    // Validate input
    const validatedData = registerArtifactSchema.parse(input);

    // Verify the storage key belongs to this org (security check)
    if (!validateStorageKeyOwnership(validatedData.storageKey, orgId)) {
      return {
        success: false,
        error: "Invalid storage key for this organization",
      };
    }

    // Verify the experiment belongs to this org
    const experiment = await db.query.experiments.findFirst({
      where: and(
        eq(experiments.id, validatedData.experimentId),
        eq(experiments.orgId, orgId)
      ),
    });

    if (!experiment) {
      return {
        success: false,
        error: "Experiment not found or access denied",
      };
    }

    // If sampleId is provided, verify it belongs to this org and experiment
    if (validatedData.sampleId) {
      const sample = await db.query.samples.findFirst({
        where: and(
          eq(samples.id, validatedData.sampleId),
          eq(samples.orgId, orgId),
          eq(samples.experimentId, validatedData.experimentId)
        ),
      });

      if (!sample) {
        return {
          success: false,
          error: "Sample not found or does not belong to this experiment",
        };
      }
    }

    // Create the artifact record
    const [artifact] = await db
      .insert(rawArtifacts)
      .values({
        orgId, // Use authenticated org ID
        experimentId: validatedData.experimentId,
        sampleId: validatedData.sampleId || null,
        storageKey: validatedData.storageKey,
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize || null,
        sha256: validatedData.sha256.toLowerCase(), // Normalize hash
        schemaVersion: validatedData.schemaVersion || "v1",
      })
      .returning({ id: rawArtifacts.id });

    revalidatePath(`/experiments/${validatedData.experimentId}`);
    if (validatedData.sampleId) {
      revalidatePath(`/samples/${validatedData.sampleId}`);
    }

    return { success: true, data: { id: artifact.id } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error registering artifact:", error);
    return { success: false, error: "Failed to register artifact" };
  }
}

/**
 * Get a download URL for an artifact
 * Verifies org ownership before generating URL
 */
export async function getArtifactDownloadUrl(
  artifactId: string
): Promise<{ success: boolean; data?: { downloadUrl: string }; error?: string }> {
  try {
    const { orgId } = await getAuthContext();

    // Get artifact and verify org ownership
    const artifact = await db.query.rawArtifacts.findFirst({
      where: and(
        eq(rawArtifacts.id, artifactId),
        eq(rawArtifacts.orgId, orgId) // Critical: verify org ownership
      ),
    });

    if (!artifact) {
      return { success: false, error: "Artifact not found" };
    }

    // Generate download URL
    const downloadUrl = await generateDownloadUrl(artifact.storageKey);

    return { success: true, data: { downloadUrl } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error generating download URL:", error);
    return { success: false, error: "Failed to generate download URL" };
  }
}

/**
 * Delete an artifact
 * Verifies org ownership before deletion
 * Note: This does not delete the file from S3 - implement cleanup separately
 */
export async function deleteArtifact(
  artifactId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await getAuthContext();

    // Get artifact first to get paths for revalidation
    const artifact = await db.query.rawArtifacts.findFirst({
      where: and(
        eq(rawArtifacts.id, artifactId),
        eq(rawArtifacts.orgId, orgId)
      ),
      columns: { experimentId: true, sampleId: true },
    });

    if (!artifact) {
      return { success: false, error: "Artifact not found" };
    }

    // Delete the artifact record
    await db
      .delete(rawArtifacts)
      .where(
        and(eq(rawArtifacts.id, artifactId), eq(rawArtifacts.orgId, orgId))
      );

    revalidatePath(`/experiments/${artifact.experimentId}`);
    if (artifact.sampleId) {
      revalidatePath(`/samples/${artifact.sampleId}`);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Error deleting artifact:", error);
    return { success: false, error: "Failed to delete artifact" };
  }
}
