"use server";

import { db } from "@/db";
import { samples, experiments, rawArtifacts, sampleFeatures } from "@/db/schema";
import { getAuthContext, getAuthContextWithOrgId } from "@/lib/auth";
import { eq, and, desc, count } from "drizzle-orm";

export interface SampleWithDetails {
  id: string;
  sampleLabel: string | null;
  patientPseudonym: string | null;
  matrixType: string | null;
  collectedAt: Date | null;
  createdAt: Date;
  experimentId: string;
  experimentName: string;
  artifactsCount: number;
  hasFeatures: boolean;
}

export interface SampleDetail {
  id: string;
  sampleLabel: string | null;
  patientPseudonym: string | null;
  matrixType: string | null;
  collectedAt: Date | null;
  createdAt: Date;
  experimentId: string;
  experimentName: string;
  artifacts: Array<{
    id: string;
    fileName: string;
    fileType: string | null;
    schemaVersion: string | null;
    createdAt: Date;
  }>;
}

export async function listAllSamples(): Promise<{
  success: boolean;
  data?: SampleWithDetails[];
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
      .select({
        id: samples.id,
        sampleLabel: samples.sampleLabel,
        patientPseudonym: samples.patientPseudonym,
        matrixType: samples.matrixType,
        collectedAt: samples.collectedAt,
        createdAt: samples.createdAt,
        experimentId: samples.experimentId,
        experimentName: experiments.name,
      })
      .from(samples)
      .innerJoin(experiments, eq(samples.experimentId, experiments.id))
      .where(eq(samples.orgId, orgId))
      .orderBy(desc(samples.createdAt));

    // Get artifact counts and feature status for each sample
    const samplesWithDetails = await Promise.all(
      result.map(async (sample) => {
        const [artifactsResult] = await db
          .select({ count: count() })
          .from(rawArtifacts)
          .where(
            and(
              eq(rawArtifacts.sampleId, sample.id),
              eq(rawArtifacts.orgId, orgId)
            )
          );

        const [featuresResult] = await db
          .select({ count: count() })
          .from(sampleFeatures)
          .where(
            and(
              eq(sampleFeatures.sampleId, sample.id),
              eq(sampleFeatures.orgId, orgId)
            )
          );

        return {
          ...sample,
          artifactsCount: artifactsResult?.count || 0,
          hasFeatures: (featuresResult?.count || 0) > 0,
        };
      })
    );

    return { success: true, data: samplesWithDetails };
  } catch (error) {
    console.error("Error listing samples:", error);
    return { success: false, error: "Failed to list samples" };
  }
}

export async function getSample(sampleId: string): Promise<{
  success: boolean;
  data?: SampleDetail;
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

    const [result] = await db
      .select({
        id: samples.id,
        sampleLabel: samples.sampleLabel,
        patientPseudonym: samples.patientPseudonym,
        matrixType: samples.matrixType,
        collectedAt: samples.collectedAt,
        createdAt: samples.createdAt,
        experimentId: samples.experimentId,
        experimentName: experiments.name,
      })
      .from(samples)
      .innerJoin(experiments, eq(samples.experimentId, experiments.id))
      .where(and(eq(samples.id, sampleId), eq(samples.orgId, orgId)));

    if (!result) {
      return { success: false, error: "Sample not found" };
    }

    // Get artifacts
    const artifacts = await db
      .select({
        id: rawArtifacts.id,
        fileName: rawArtifacts.fileName,
        fileType: rawArtifacts.fileType,
        schemaVersion: rawArtifacts.schemaVersion,
        createdAt: rawArtifacts.createdAt,
      })
      .from(rawArtifacts)
      .where(
        and(
          eq(rawArtifacts.sampleId, sampleId),
          eq(rawArtifacts.orgId, orgId)
        )
      )
      .orderBy(desc(rawArtifacts.createdAt));

    return {
      success: true,
      data: {
        ...result,
        artifacts,
      },
    };
  } catch (error) {
    console.error("Error getting sample:", error);
    return { success: false, error: "Failed to get sample" };
  }
}

export interface CreateSampleInput {
  experimentId: string;
  sampleLabel?: string;
  patientPseudonym?: string;
  matrixType?: string;
  collectedAt?: Date;
}

export async function createSample(input: CreateSampleInput, clerkOrgId?: string): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const authContext = clerkOrgId 
      ? await getAuthContextWithOrgId(clerkOrgId)
      : await getAuthContext();
    if (!authContext) {
      return { success: false, error: "Unauthorized" };
    }

    const { orgId } = authContext;
    if (!orgId) {
      return { success: false, error: "No organization selected" };
    }

    // Verify experiment belongs to org
    const [experiment] = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, input.experimentId), eq(experiments.orgId, orgId)));

    if (!experiment) {
      return { success: false, error: "Experiment not found" };
    }

    const [sample] = await db
      .insert(samples)
      .values({
        orgId,
        experimentId: input.experimentId,
        sampleLabel: input.sampleLabel || null,
        patientPseudonym: input.patientPseudonym || null,
        matrixType: input.matrixType || null,
        collectedAt: input.collectedAt || null,
      })
      .returning({ id: samples.id });

    return { success: true, data: { id: sample.id } };
  } catch (error) {
    console.error("Error creating sample:", error);
    return { success: false, error: "Failed to create sample" };
  }
}
