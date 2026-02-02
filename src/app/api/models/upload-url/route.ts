import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateModelStorageKey, generateUploadUrl } from "@/lib/s3";

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
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // Generate storage key using internal org ID
    const storageKey = generateModelStorageKey(org.id, fileName);

    // Generate presigned upload URL
    const { uploadUrl } = await generateUploadUrl(storageKey, "application/zip");

    return NextResponse.json({
      success: true,
      uploadUrl,
      storageKey,
    });
  } catch (error) {
    console.error("Error generating model upload URL:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to generate upload URL" 
      },
      { status: 500 }
    );
  }
}
