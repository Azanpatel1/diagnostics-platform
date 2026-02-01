"use server";

import { db } from "@/db";
import {
  sampleFeatures,
  featureSets,
  samples,
  SampleFeature,
  FeatureSet,
} from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

// Core v1 feature set definition
const CORE_V1_FEATURES = {
  timeseries: [
    "baseline_mean",
    "baseline_std",
    "y_max",
    "y_min",
    "t_at_max",
    "auc",
    "slope_early",
    "t_halfmax",
    "snr",
  ],
  endpoint: ["endpoint_value"],
  global: ["num_channels", "signal_quality_flag"],
};

/**
 * Get or create the core_v1 feature set for an org
 */
export async function getOrCreateCoreV1FeatureSet(): Promise<
  { success: true; featureSet: FeatureSet } | { success: false; error: string }
> {
  try {
    const { orgId } = await getAuthContext();

    // Check if feature set already exists
    const [existing] = await db
      .select()
      .from(featureSets)
      .where(
        and(
          eq(featureSets.orgId, orgId),
          eq(featureSets.name, "core_v1")
        )
      )
      .limit(1);

    if (existing) {
      return { success: true, featureSet: existing };
    }

    // Create the feature set
    const [featureSet] = await db
      .insert(featureSets)
      .values({
        orgId,
        name: "core_v1",
        version: "1.0.0",
        featureList: CORE_V1_FEATURES,
      })
      .returning();

    return { success: true, featureSet };
  } catch (error) {
    console.error("Failed to get/create feature set:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get feature set",
    };
  }
}

/**
 * Get a feature set by name (org-scoped)
 */
export async function getFeatureSet(
  name: string
): Promise<{ success: true; featureSet: FeatureSet | null } | { success: false; error: string }> {
  try {
    const { orgId } = await getAuthContext();

    const [featureSet] = await db
      .select()
      .from(featureSets)
      .where(and(eq(featureSets.orgId, orgId), eq(featureSets.name, name)))
      .limit(1);

    return { success: true, featureSet: featureSet || null };
  } catch (error) {
    console.error("Failed to get feature set:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get feature set",
    };
  }
}

/**
 * Get computed features for a sample
 */
export async function getSampleFeatures(
  sampleId: string
): Promise<
  { success: true; features: SampleFeature[] } | { success: false; error: string }
> {
  try {
    const { orgId } = await getAuthContext();

    // Verify sample belongs to this org
    const [sample] = await db
      .select()
      .from(samples)
      .where(and(eq(samples.id, sampleId), eq(samples.orgId, orgId)))
      .limit(1);

    if (!sample) {
      return { success: false, error: "Sample not found" };
    }

    // Get all computed features for this sample
    const features = await db
      .select()
      .from(sampleFeatures)
      .where(
        and(
          eq(sampleFeatures.sampleId, sampleId),
          eq(sampleFeatures.orgId, orgId)
        )
      )
      .orderBy(desc(sampleFeatures.computedAt));

    return { success: true, features };
  } catch (error) {
    console.error("Failed to get sample features:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get features",
    };
  }
}

/**
 * Get the latest computed features for a sample with a specific feature set
 */
export async function getSampleFeaturesBySet(
  sampleId: string,
  featureSetName: string = "core_v1"
): Promise<
  { success: true; feature: SampleFeature | null } | { success: false; error: string }
> {
  try {
    const { orgId } = await getAuthContext();

    // Get the feature set
    const [featureSet] = await db
      .select()
      .from(featureSets)
      .where(
        and(
          eq(featureSets.orgId, orgId),
          eq(featureSets.name, featureSetName)
        )
      )
      .limit(1);

    if (!featureSet) {
      return { success: true, feature: null };
    }

    // Get the feature for this sample and feature set
    const [feature] = await db
      .select()
      .from(sampleFeatures)
      .where(
        and(
          eq(sampleFeatures.sampleId, sampleId),
          eq(sampleFeatures.featureSetId, featureSet.id),
          eq(sampleFeatures.orgId, orgId)
        )
      )
      .limit(1);

    return { success: true, feature: feature || null };
  } catch (error) {
    console.error("Failed to get sample features by set:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get features",
    };
  }
}

/**
 * List all feature sets for the org
 */
export async function listFeatureSets(): Promise<
  { success: true; featureSets: FeatureSet[] } | { success: false; error: string }
> {
  try {
    const { orgId } = await getAuthContext();

    const sets = await db
      .select()
      .from(featureSets)
      .where(eq(featureSets.orgId, orgId))
      .orderBy(desc(featureSets.createdAt));

    return { success: true, featureSets: sets };
  } catch (error) {
    console.error("Failed to list feature sets:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list feature sets",
    };
  }
}
