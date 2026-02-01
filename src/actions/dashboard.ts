"use server";

import { db } from "@/db";
import { experiments, samples, rawArtifacts, sampleFeatures, jobs } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { eq, and, count, desc, gte } from "drizzle-orm";

export interface DashboardStats {
  totalExperiments: number;
  totalSamples: number;
  totalArtifacts: number;
  processedSamples: number;
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export interface RecentActivity {
  id: string;
  type: "experiment" | "sample" | "artifact" | "job";
  title: string;
  description: string;
  timestamp: Date;
  status?: string;
}

export async function getDashboardStats(): Promise<{
  success: boolean;
  data?: DashboardStats;
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

    // Get counts in parallel
    const [
      experimentsCount,
      samplesCount,
      artifactsCount,
      processedCount,
      pendingJobsCount,
      completedJobsCount,
      failedJobsCount,
    ] = await Promise.all([
      db.select({ count: count() }).from(experiments).where(eq(experiments.orgId, orgId)),
      db.select({ count: count() }).from(samples).where(eq(samples.orgId, orgId)),
      db.select({ count: count() }).from(rawArtifacts).where(eq(rawArtifacts.orgId, orgId)),
      db.select({ count: count() }).from(sampleFeatures).where(eq(sampleFeatures.orgId, orgId)),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.status, "queued"))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.status, "succeeded"))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.status, "failed"))),
    ]);

    return {
      success: true,
      data: {
        totalExperiments: experimentsCount[0]?.count || 0,
        totalSamples: samplesCount[0]?.count || 0,
        totalArtifacts: artifactsCount[0]?.count || 0,
        processedSamples: processedCount[0]?.count || 0,
        pendingJobs: pendingJobsCount[0]?.count || 0,
        completedJobs: completedJobsCount[0]?.count || 0,
        failedJobs: failedJobsCount[0]?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return { success: false, error: "Failed to fetch dashboard stats" };
  }
}

export async function getRecentActivity(): Promise<{
  success: boolean;
  data?: RecentActivity[];
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

    // Get recent experiments
    const recentExperiments = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        createdAt: experiments.createdAt,
      })
      .from(experiments)
      .where(eq(experiments.orgId, orgId))
      .orderBy(desc(experiments.createdAt))
      .limit(3);

    // Get recent samples
    const recentSamples = await db
      .select({
        id: samples.id,
        label: samples.sampleLabel,
        createdAt: samples.createdAt,
      })
      .from(samples)
      .where(eq(samples.orgId, orgId))
      .orderBy(desc(samples.createdAt))
      .limit(3);

    // Get recent jobs
    const recentJobs = await db
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.orgId, orgId))
      .orderBy(desc(jobs.createdAt))
      .limit(3);

    // Combine and sort by timestamp
    const activities: RecentActivity[] = [
      ...recentExperiments.map((e) => ({
        id: e.id,
        type: "experiment" as const,
        title: "New Experiment",
        description: e.name,
        timestamp: e.createdAt,
      })),
      ...recentSamples.map((s) => ({
        id: s.id,
        type: "sample" as const,
        title: "New Sample",
        description: s.label || "Unnamed sample",
        timestamp: s.createdAt,
      })),
      ...recentJobs.map((j) => ({
        id: j.id,
        type: "job" as const,
        title: "Processing Job",
        description: j.type,
        timestamp: j.createdAt,
        status: j.status,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

    return { success: true, data: activities };
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return { success: false, error: "Failed to fetch recent activity" };
  }
}

export async function getRecentExperiments(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    samplesCount: number;
    createdAt: Date;
  }>;
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

    const recentExperiments = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        createdAt: experiments.createdAt,
      })
      .from(experiments)
      .where(eq(experiments.orgId, orgId))
      .orderBy(desc(experiments.createdAt))
      .limit(5);

    // Get sample counts for each experiment
    const withCounts = await Promise.all(
      recentExperiments.map(async (exp) => {
        const [result] = await db
          .select({ count: count() })
          .from(samples)
          .where(and(eq(samples.experimentId, exp.id), eq(samples.orgId, orgId)));
        return {
          ...exp,
          samplesCount: result?.count || 0,
        };
      })
    );

    return { success: true, data: withCounts };
  } catch (error) {
    console.error("Error fetching recent experiments:", error);
    return { success: false, error: "Failed to fetch recent experiments" };
  }
}
