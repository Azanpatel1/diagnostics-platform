import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { featureSets, orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
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
    let org = await db.query.orgs.findFirst({
      where: eq(orgs.clerkOrgId, effectiveOrgId),
    });

    // Auto-create org if it doesn't exist
    if (!org) {
      const [newOrg] = await db
        .insert(orgs)
        .values({
          clerkOrgId: effectiveOrgId,
          name: "Organization",
        })
        .returning();
      org = newOrg;
    }

    // Get feature sets for this org
    let sets = await db
      .select({
        id: featureSets.id,
        name: featureSets.name,
        version: featureSets.version,
      })
      .from(featureSets)
      .where(eq(featureSets.orgId, org.id))
      .orderBy(featureSets.name);

    // Auto-create core_v1 feature set if none exist
    if (sets.length === 0) {
      const [newFeatureSet] = await db
        .insert(featureSets)
        .values({
          orgId: org.id,
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
    }

    return NextResponse.json({
      success: true,
      data: sets,
    });
  } catch (error) {
    console.error("Error listing feature sets:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to list feature sets" 
      },
      { status: 500 }
    );
  }
}
