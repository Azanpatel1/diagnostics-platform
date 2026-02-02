"use server";

import { db } from "@/db";
import { 
  modelRegistry, 
  featureSets, 
  predictions, 
  leafEmbeddings,
  type ModelRegistry,
} from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { deleteFile } from "@/lib/s3";

export interface ModelWithDetails extends ModelRegistry {
  featureSetName: string;
  featureSetVersion: string;
  predictionsCount?: number;
}

export interface CreateModelInput {
  name: string;
  version: string;
  task: string;
  featureSetId: string;
  storageKey: string;
  modelFormat?: string;
  metrics?: Record<string, unknown>;
}

/**
 * List all models for the current organization.
 */
export async function listModels(): Promise<{
  success: boolean;
  data?: ModelWithDetails[];
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    const models = await db
      .select({
        id: modelRegistry.id,
        orgId: modelRegistry.orgId,
        name: modelRegistry.name,
        version: modelRegistry.version,
        task: modelRegistry.task,
        featureSetId: modelRegistry.featureSetId,
        storageKey: modelRegistry.storageKey,
        modelFormat: modelRegistry.modelFormat,
        metrics: modelRegistry.metrics,
        isActive: modelRegistry.isActive,
        createdAt: modelRegistry.createdAt,
        featureSetName: featureSets.name,
        featureSetVersion: featureSets.version,
      })
      .from(modelRegistry)
      .innerJoin(featureSets, eq(modelRegistry.featureSetId, featureSets.id))
      .where(eq(modelRegistry.orgId, orgId))
      .orderBy(desc(modelRegistry.createdAt));

    return { success: true, data: models };
  } catch (error) {
    console.error("Error listing models:", error);
    return { success: false, error: "Failed to list models" };
  }
}

/**
 * Get a specific model by ID.
 */
export async function getModel(modelId: string): Promise<{
  success: boolean;
  data?: ModelWithDetails;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    const [model] = await db
      .select({
        id: modelRegistry.id,
        orgId: modelRegistry.orgId,
        name: modelRegistry.name,
        version: modelRegistry.version,
        task: modelRegistry.task,
        featureSetId: modelRegistry.featureSetId,
        storageKey: modelRegistry.storageKey,
        modelFormat: modelRegistry.modelFormat,
        metrics: modelRegistry.metrics,
        isActive: modelRegistry.isActive,
        createdAt: modelRegistry.createdAt,
        featureSetName: featureSets.name,
        featureSetVersion: featureSets.version,
      })
      .from(modelRegistry)
      .innerJoin(featureSets, eq(modelRegistry.featureSetId, featureSets.id))
      .where(and(eq(modelRegistry.id, modelId), eq(modelRegistry.orgId, orgId)));

    if (!model) {
      return { success: false, error: "Model not found" };
    }

    return { success: true, data: model };
  } catch (error) {
    console.error("Error getting model:", error);
    return { success: false, error: "Failed to get model" };
  }
}

/**
 * Get the active model for a given task.
 */
export async function getActiveModel(task: string = "binary_classification"): Promise<{
  success: boolean;
  data?: ModelWithDetails;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    const [model] = await db
      .select({
        id: modelRegistry.id,
        orgId: modelRegistry.orgId,
        name: modelRegistry.name,
        version: modelRegistry.version,
        task: modelRegistry.task,
        featureSetId: modelRegistry.featureSetId,
        storageKey: modelRegistry.storageKey,
        modelFormat: modelRegistry.modelFormat,
        metrics: modelRegistry.metrics,
        isActive: modelRegistry.isActive,
        createdAt: modelRegistry.createdAt,
        featureSetName: featureSets.name,
        featureSetVersion: featureSets.version,
      })
      .from(modelRegistry)
      .innerJoin(featureSets, eq(modelRegistry.featureSetId, featureSets.id))
      .where(
        and(
          eq(modelRegistry.orgId, orgId),
          eq(modelRegistry.task, task),
          eq(modelRegistry.isActive, true)
        )
      );

    if (!model) {
      return { success: false, error: "No active model found for task" };
    }

    return { success: true, data: model };
  } catch (error) {
    console.error("Error getting active model:", error);
    return { success: false, error: "Failed to get active model" };
  }
}

/**
 * Register a new model in the registry.
 * Requires admin or owner role.
 */
export async function registerModel(input: CreateModelInput): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId, role } = authContext;

    // Check role - only admin or owner can register models
    if (role !== "admin" && role !== "owner" && role !== "org:admin") {
      return { success: false, error: "Insufficient permissions to register models" };
    }

    // Verify feature set belongs to org
    const featureSet = await db.query.featureSets.findFirst({
      where: and(
        eq(featureSets.id, input.featureSetId),
        eq(featureSets.orgId, orgId)
      ),
    });

    if (!featureSet) {
      return { success: false, error: "Feature set not found" };
    }

    // Insert model
    const [model] = await db
      .insert(modelRegistry)
      .values({
        orgId,
        name: input.name,
        version: input.version,
        task: input.task,
        featureSetId: input.featureSetId,
        storageKey: input.storageKey,
        modelFormat: input.modelFormat || "xgboost_json",
        metrics: input.metrics || null,
        isActive: false,
      })
      .returning({ id: modelRegistry.id });

    return { success: true, data: { id: model.id } };
  } catch (error) {
    console.error("Error registering model:", error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return { 
        success: false, 
        error: "A model with this name and version already exists" 
      };
    }
    
    return { success: false, error: "Failed to register model" };
  }
}

/**
 * Toggle a model's active status.
 * When activating a model, deactivates other models with the same task.
 * Requires admin or owner role.
 */
export async function toggleModelActive(
  modelId: string,
  isActive: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId, role } = authContext;

    // Check role
    if (role !== "admin" && role !== "owner" && role !== "org:admin") {
      return { success: false, error: "Insufficient permissions" };
    }

    // Get the model
    const model = await db.query.modelRegistry.findFirst({
      where: and(
        eq(modelRegistry.id, modelId),
        eq(modelRegistry.orgId, orgId)
      ),
    });

    if (!model) {
      return { success: false, error: "Model not found" };
    }

    if (isActive) {
      // Deactivate other models with the same task first
      await db
        .update(modelRegistry)
        .set({ isActive: false })
        .where(
          and(
            eq(modelRegistry.orgId, orgId),
            eq(modelRegistry.task, model.task),
            eq(modelRegistry.isActive, true)
          )
        );
    }

    // Update the target model
    await db
      .update(modelRegistry)
      .set({ isActive })
      .where(eq(modelRegistry.id, modelId));

    return { success: true };
  } catch (error) {
    console.error("Error toggling model active status:", error);
    return { success: false, error: "Failed to update model" };
  }
}

/**
 * Delete a model from the registry.
 * Also deletes associated predictions, leaf embeddings, and S3 bundle.
 * Requires admin or owner role.
 */
export async function deleteModel(modelId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId, role } = authContext;

    // Check role
    if (role !== "admin" && role !== "owner" && role !== "org:admin") {
      return { success: false, error: "Insufficient permissions" };
    }

    // Get the model
    const model = await db.query.modelRegistry.findFirst({
      where: and(
        eq(modelRegistry.id, modelId),
        eq(modelRegistry.orgId, orgId)
      ),
    });

    if (!model) {
      return { success: false, error: "Model not found" };
    }

    // Delete predictions and leaf embeddings (cascade will handle this, but be explicit)
    await db
      .delete(predictions)
      .where(eq(predictions.modelId, modelId));
    
    await db
      .delete(leafEmbeddings)
      .where(eq(leafEmbeddings.modelId, modelId));

    // Delete from S3
    try {
      await deleteFile(model.storageKey);
    } catch (s3Error) {
      console.error("Error deleting model bundle from S3:", s3Error);
      // Continue with DB deletion even if S3 fails
    }

    // Delete the model
    await db
      .delete(modelRegistry)
      .where(eq(modelRegistry.id, modelId));

    return { success: true };
  } catch (error) {
    console.error("Error deleting model:", error);
    return { success: false, error: "Failed to delete model" };
  }
}

/**
 * List available feature sets for model registration.
 * Auto-creates the core_v1 feature set if none exist for the org.
 */
export async function listFeatureSets(): Promise<{
  success: boolean;
  data?: Array<{ id: string; name: string; version: string }>;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    let sets = await db
      .select({
        id: featureSets.id,
        name: featureSets.name,
        version: featureSets.version,
      })
      .from(featureSets)
      .where(eq(featureSets.orgId, orgId))
      .orderBy(featureSets.name);

    // If no feature sets found, auto-create the core_v1 feature set
    if (sets.length === 0) {
      console.log("[listFeatureSets] No feature sets found for org, creating core_v1...");
      
      try {
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
          .returning({
            id: featureSets.id,
            name: featureSets.name,
            version: featureSets.version,
          });
        
        sets = [newFeatureSet];
        console.log("[listFeatureSets] Created core_v1 feature set:", newFeatureSet.id);
      } catch (insertError) {
        // If insert fails (e.g., race condition), try fetching again
        console.log("[listFeatureSets] Insert failed, re-fetching:", insertError);
        sets = await db
          .select({
            id: featureSets.id,
            name: featureSets.name,
            version: featureSets.version,
          })
          .from(featureSets)
          .where(eq(featureSets.orgId, orgId))
          .orderBy(featureSets.name);
      }
    }

    return { success: true, data: sets };
  } catch (error) {
    console.error("Error listing feature sets:", error);
    return { success: false, error: "Failed to list feature sets" };
  }
}
