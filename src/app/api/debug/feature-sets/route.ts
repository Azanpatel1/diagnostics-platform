import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { featureSets, orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId, orgId: clerkOrgId } = await auth();

    // Get ALL feature sets in the database (no filtering)
    const allFeatureSets = await db
      .select({
        id: featureSets.id,
        orgId: featureSets.orgId,
        name: featureSets.name,
        version: featureSets.version,
      })
      .from(featureSets)
      .limit(10);

    // Get ALL orgs in the database
    const allOrgs = await db
      .select({
        id: orgs.id,
        clerkOrgId: orgs.clerkOrgId,
        name: orgs.name,
      })
      .from(orgs)
      .limit(10);

    // If we have a clerkOrgId, find the matching internal org
    let matchingOrg = null;
    if (clerkOrgId) {
      const [found] = await db
        .select()
        .from(orgs)
        .where(eq(orgs.clerkOrgId, clerkOrgId))
        .limit(1);
      matchingOrg = found;
    }

    // If we found an org, get feature sets for that org
    let orgFeatureSets: typeof allFeatureSets = [];
    if (matchingOrg) {
      orgFeatureSets = await db
        .select({
          id: featureSets.id,
          orgId: featureSets.orgId,
          name: featureSets.name,
          version: featureSets.version,
        })
        .from(featureSets)
        .where(eq(featureSets.orgId, matchingOrg.id));
    }

    return NextResponse.json({
      auth: {
        userId,
        clerkOrgId,
      },
      matchingOrg: matchingOrg
        ? {
            id: matchingOrg.id,
            clerkOrgId: matchingOrg.clerkOrgId,
            name: matchingOrg.name,
          }
        : null,
      orgFeatureSets,
      allFeatureSets,
      allOrgs,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
