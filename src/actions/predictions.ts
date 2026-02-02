"use server";

import { db } from "@/db";
import { 
  predictions, 
  leafEmbeddings, 
  modelRegistry,
  samples,
  experiments,
} from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { eq, and, desc, inArray } from "drizzle-orm";

export interface PredictionWithModel {
  id: string;
  sampleId: string;
  modelId: string;
  modelName: string;
  modelVersion: string;
  yHat: number;
  threshold: number;
  predictedClass: number;
  createdAt: Date;
}

export interface LeafEmbeddingData {
  id: string;
  sampleId: string;
  modelId: string;
  leafIndices: number[];
  createdAt: Date;
}

export interface SampleWithPrediction {
  id: string;
  sampleLabel: string;
  patientPseudonym: string | null;
  matrixType: string | null;
  createdAt: Date;
  hasFeatures: boolean;
  prediction?: {
    yHat: number;
    predictedClass: number;
    modelName: string;
    modelVersion: string;
  };
}

/**
 * Get the latest prediction for a sample.
 */
export async function getPrediction(sampleId: string): Promise<{
  success: boolean;
  data?: PredictionWithModel;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    const [result] = await db
      .select({
        id: predictions.id,
        sampleId: predictions.sampleId,
        modelId: predictions.modelId,
        modelName: modelRegistry.name,
        modelVersion: modelRegistry.version,
        yHat: predictions.yHat,
        threshold: predictions.threshold,
        predictedClass: predictions.predictedClass,
        createdAt: predictions.createdAt,
      })
      .from(predictions)
      .innerJoin(modelRegistry, eq(predictions.modelId, modelRegistry.id))
      .where(
        and(
          eq(predictions.sampleId, sampleId),
          eq(predictions.orgId, orgId)
        )
      )
      .orderBy(desc(predictions.createdAt))
      .limit(1);

    if (!result) {
      return { success: false, error: "No prediction found" };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting prediction:", error);
    return { success: false, error: "Failed to get prediction" };
  }
}

/**
 * Get the leaf embedding for a sample and model.
 */
export async function getLeafEmbedding(
  sampleId: string,
  modelId: string
): Promise<{
  success: boolean;
  data?: LeafEmbeddingData;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    const [result] = await db
      .select({
        id: leafEmbeddings.id,
        sampleId: leafEmbeddings.sampleId,
        modelId: leafEmbeddings.modelId,
        leafIndices: leafEmbeddings.leafIndices,
        createdAt: leafEmbeddings.createdAt,
      })
      .from(leafEmbeddings)
      .where(
        and(
          eq(leafEmbeddings.sampleId, sampleId),
          eq(leafEmbeddings.modelId, modelId),
          eq(leafEmbeddings.orgId, orgId)
        )
      );

    if (!result) {
      return { success: false, error: "No leaf embedding found" };
    }

    return { 
      success: true, 
      data: {
        ...result,
        leafIndices: result.leafIndices as number[],
      }
    };
  } catch (error) {
    console.error("Error getting leaf embedding:", error);
    return { success: false, error: "Failed to get leaf embedding" };
  }
}

/**
 * Get predictions for all samples in an experiment.
 */
export async function getPredictionsForExperiment(experimentId: string): Promise<{
  success: boolean;
  data?: Map<string, PredictionWithModel>;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    // Verify experiment belongs to org
    const experiment = await db.query.experiments.findFirst({
      where: and(
        eq(experiments.id, experimentId),
        eq(experiments.orgId, orgId)
      ),
    });

    if (!experiment) {
      return { success: false, error: "Experiment not found" };
    }

    // Get all sample IDs for the experiment
    const experimentSamples = await db
      .select({ id: samples.id })
      .from(samples)
      .where(
        and(
          eq(samples.experimentId, experimentId),
          eq(samples.orgId, orgId)
        )
      );

    if (experimentSamples.length === 0) {
      return { success: true, data: new Map() };
    }

    const sampleIds = experimentSamples.map((s) => s.id);

    // Get predictions for these samples
    const predictionResults = await db
      .select({
        id: predictions.id,
        sampleId: predictions.sampleId,
        modelId: predictions.modelId,
        modelName: modelRegistry.name,
        modelVersion: modelRegistry.version,
        yHat: predictions.yHat,
        threshold: predictions.threshold,
        predictedClass: predictions.predictedClass,
        createdAt: predictions.createdAt,
      })
      .from(predictions)
      .innerJoin(modelRegistry, eq(predictions.modelId, modelRegistry.id))
      .where(
        and(
          inArray(predictions.sampleId, sampleIds),
          eq(predictions.orgId, orgId)
        )
      );

    // Build map keyed by sample ID (use most recent prediction per sample)
    const predictionMap = new Map<string, PredictionWithModel>();
    for (const pred of predictionResults) {
      const existing = predictionMap.get(pred.sampleId);
      if (!existing || pred.createdAt > existing.createdAt) {
        predictionMap.set(pred.sampleId, pred);
      }
    }

    return { success: true, data: predictionMap };
  } catch (error) {
    console.error("Error getting predictions for experiment:", error);
    return { success: false, error: "Failed to get predictions" };
  }
}

/**
 * Get all predictions for a sample (all models).
 */
export async function getAllPredictionsForSample(sampleId: string): Promise<{
  success: boolean;
  data?: PredictionWithModel[];
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    const { orgId } = authContext;

    const results = await db
      .select({
        id: predictions.id,
        sampleId: predictions.sampleId,
        modelId: predictions.modelId,
        modelName: modelRegistry.name,
        modelVersion: modelRegistry.version,
        yHat: predictions.yHat,
        threshold: predictions.threshold,
        predictedClass: predictions.predictedClass,
        createdAt: predictions.createdAt,
      })
      .from(predictions)
      .innerJoin(modelRegistry, eq(predictions.modelId, modelRegistry.id))
      .where(
        and(
          eq(predictions.sampleId, sampleId),
          eq(predictions.orgId, orgId)
        )
      )
      .orderBy(desc(predictions.createdAt));

    return { success: true, data: results };
  } catch (error) {
    console.error("Error getting all predictions for sample:", error);
    return { success: false, error: "Failed to get predictions" };
  }
}
