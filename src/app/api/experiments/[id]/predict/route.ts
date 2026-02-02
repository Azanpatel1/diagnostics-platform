import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { samples, modelRegistry, experiments, orgs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const MAX_SAMPLES_FOR_LOOP = 25; // Max samples to process in Next.js loop

interface BatchPredictResponse {
  status: string;
  model_id: string;
  total_samples: number;
  successful: number;
  failed: number;
  results: Array<{
    status: string;
    sample_id: string;
    model_id: string;
    y_hat: number;
    threshold: number;
    predicted_class: number;
    num_trees: number;
  }>;
  errors: Array<{
    sample_id: string;
    error: string;
  }>;
}

interface ErrorResponse {
  status: string;
  message: string;
  details?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const orgId = org.id;
    const { id: experimentId } = await params;

    // Parse request body for optional model_id override
    let modelId: string | undefined;
    try {
      const body = await request.json();
      modelId = body.model_id;
    } catch {
      // No body provided, will use active model
    }

    // Verify experiment belongs to org
    const experiment = await db.query.experiments.findFirst({
      where: and(
        eq(experiments.id, experimentId),
        eq(experiments.orgId, orgId)
      ),
    });

    if (!experiment) {
      return NextResponse.json(
        { error: "Experiment not found" },
        { status: 404 }
      );
    }

    // Get active model if not specified
    let model;
    if (modelId) {
      model = await db.query.modelRegistry.findFirst({
        where: and(
          eq(modelRegistry.id, modelId),
          eq(modelRegistry.orgId, orgId)
        ),
      });
    } else {
      model = await db.query.modelRegistry.findFirst({
        where: and(
          eq(modelRegistry.orgId, orgId),
          eq(modelRegistry.task, "binary_classification"),
          eq(modelRegistry.isActive, true)
        ),
      });
    }

    if (!model) {
      return NextResponse.json(
        { error: "No active model found. Please activate a model first." },
        { status: 400 }
      );
    }

    // Get all samples for the experiment
    const experimentSamples = await db
      .select({ id: samples.id })
      .from(samples)
      .where(
        and(eq(samples.experimentId, experimentId), eq(samples.orgId, orgId))
      );

    if (experimentSamples.length === 0) {
      return NextResponse.json(
        { error: "No samples found in experiment" },
        { status: 400 }
      );
    }

    const sampleIds = experimentSamples.map((s) => s.id);

    // Use batch endpoint for efficiency
    const mlResponse = await fetch(`${ML_SERVICE_URL}/v1/predict-xgboost-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        org_id: orgId,
        model_id: model.id,
        sample_ids: sampleIds,
      }),
    });

    if (!mlResponse.ok) {
      const errorData = (await mlResponse.json()) as ErrorResponse;
      return NextResponse.json(
        {
          success: false,
          error: errorData.message || "Batch prediction failed",
          details: errorData.details,
        },
        { status: mlResponse.status }
      );
    }

    const result = (await mlResponse.json()) as BatchPredictResponse;

    return NextResponse.json({
      success: true,
      data: {
        experimentId,
        modelId: model.id,
        modelName: model.name,
        modelVersion: model.version,
        totalSamples: result.total_samples,
        successful: result.successful,
        failed: result.failed,
        results: result.results.map((r) => ({
          sampleId: r.sample_id,
          yHat: r.y_hat,
          threshold: r.threshold,
          predictedClass: r.predicted_class,
          numTrees: r.num_trees,
        })),
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("Batch prediction error:", error);

    // Check if it's a connection error to ML service
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "ML service unavailable",
          details:
            "Could not connect to the prediction service. Please try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Batch prediction failed",
      },
      { status: 500 }
    );
  }
}
