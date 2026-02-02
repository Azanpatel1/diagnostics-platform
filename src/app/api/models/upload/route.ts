import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateModelStorageKey } from "@/lib/s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

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

    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileName = formData.get("fileName") as string | null;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: "file and fileName are required" },
        { status: 400 }
      );
    }

    // Generate storage key using internal org ID
    const storageKey = generateModelStorageKey(org.id, fileName);

    // Upload directly to S3 from server (bypasses CORS)
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: "application/zip",
      })
    );

    return NextResponse.json({
      success: true,
      storageKey,
    });
  } catch (error) {
    console.error("Error uploading model:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to upload model" 
      },
      { status: 500 }
    );
  }
}
