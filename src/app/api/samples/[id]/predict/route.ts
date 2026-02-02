import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { samples, modelRegistry, sampleFeatures, orgs, featureSets } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

interface PredictResponse {
  status: string;
  sample_id: string;
  model_id: string;
  y_hat: number;
  threshold: number;
  predicted_class: number;
  num_trees: number;
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
    const { id: sampleId } = await params;

    // Parse request body for optional model_id override
    let modelId: string | undefined;
    try {
      const body = await request.json();
      modelId = body.model_id;
    } catch {
      // No body provided, will use active model
    }

    // Verify sample belongs to org
    const sample = await db.query.samples.findFirst({
      where: and(eq(samples.id, sampleId), eq(samples.orgId, orgId)),
    });

    if (!sample) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
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

    // Check that sample has features for the model's feature set
    const features = await db.query.sampleFeatures.findFirst({
      where: and(
        eq(sampleFeatures.sampleId, sampleId),
        eq(sampleFeatures.featureSetId, model.featureSetId),
        eq(sampleFeatures.orgId, orgId)
      ),
    });

    if (!features) {
      // Get feature set name for error message
      const featureSet = await db.query.featureSets.findFirst({
        where: eq(featureSets.id, model.featureSetId),
      });
      
      return NextResponse.json(
        { 
          error: "Sample missing required features",
          details: `This sample needs features from ${featureSet?.name || "the required feature set"}. Please extract features first.`
        },
        { status: 400 }
      );
    }

    // Call ML service
    const mlResponse = await fetch(`${ML_SERVICE_URL}/v1/predict-xgboost`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        org_id: orgId,
        sample_id: sampleId,
        model_id: model.id,
      }),
    });

    if (!mlResponse.ok) {
      const errorData = (await mlResponse.json()) as ErrorResponse;
      return NextResponse.json(
        {
          success: false,
          error: errorData.message || "Prediction failed",
          details: errorData.details,
        },
        { status: mlResponse.status }
      );
    }

    const result = (await mlResponse.json()) as PredictResponse;

    return NextResponse.json({
      success: true,
      data: {
        sampleId: result.sample_id,
        modelId: result.model_id,
        modelName: model.name,
        modelVersion: model.version,
        yHat: result.y_hat,
        threshold: result.threshold,
        predictedClass: result.predicted_class,
        numTrees: result.num_trees,
      },
    });
  } catch (error) {
    console.error("Prediction error:", error);

    // Check if it's a connection error to ML service
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "ML service unavailable",
          details: "Could not connect to the prediction service. Please try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Prediction failed",
      },
      { status: 500 }
    );
  }
}
