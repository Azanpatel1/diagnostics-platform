import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { orgs, featureSets, modelRegistry } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, version, task, featureSetId, storageKey, modelFormat } = body;

    if (!name || !version || !task || !featureSetId || !storageKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify feature set belongs to org
    const featureSet = await db.query.featureSets.findFirst({
      where: and(
        eq(featureSets.id, featureSetId),
        eq(featureSets.orgId, org.id)
      ),
    });

    if (!featureSet) {
      return NextResponse.json(
        { error: "Feature set not found" },
        { status: 404 }
      );
    }

    // Insert model
    const [model] = await db
      .insert(modelRegistry)
      .values({
        orgId: org.id,
        name,
        version,
        task,
        featureSetId,
        storageKey,
        modelFormat: modelFormat || "xgboost_json",
        metrics: null,
        isActive: false,
      })
      .returning({ id: modelRegistry.id });

    return NextResponse.json({
      success: true,
      data: { id: model.id },
    });
  } catch (error) {
    console.error("Error registering model:", error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { success: false, error: "A model with this name and version already exists" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to register model" 
      },
      { status: 500 }
    );
  }
}
