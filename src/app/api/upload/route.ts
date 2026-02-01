import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db, experiments, samples, rawArtifacts, orgs } from "@/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Use path-style URLs to avoid region issues
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get clerkOrgId from header if not in auth (workaround for session sync)
    const headerOrgId = request.headers.get("x-clerk-org-id");
    const effectiveOrgId = clerkOrgId || headerOrgId;

    if (!effectiveOrgId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      );
    }

    // Get our internal org ID
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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const experimentId = formData.get("experimentId") as string;
    const sampleId = formData.get("sampleId") as string | null;
    const schemaVersion = formData.get("schemaVersion") as string;

    if (!file || !experimentId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    // If sampleId provided, verify it belongs to this experiment
    if (sampleId) {
      const sample = await db.query.samples.findFirst({
        where: and(
          eq(samples.id, sampleId),
          eq(samples.orgId, orgId),
          eq(samples.experimentId, experimentId)
        ),
      });

      if (!sample) {
        return NextResponse.json(
          { error: "Sample not found" },
          { status: 404 }
        );
      }
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    // Compute SHA-256
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Generate storage key
    const uuid = crypto.randomUUID();
    const sanitizedFileName = sanitizeFileName(file.name);
    const storageKey = `${orgId}/artifacts/${experimentId}/${uuid}-${sanitizedFileName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      Body: buffer,
      ContentType: file.type,
    });

    try {
      await s3Client.send(command);
    } catch (s3Error: unknown) {
      console.error("S3 upload error:", s3Error);
      const errorMessage = s3Error instanceof Error ? s3Error.message : String(s3Error);
      
      // Check for region mismatch
      if (errorMessage.includes("specified endpoint") || errorMessage.includes("PermanentRedirect")) {
        throw new Error(
          `S3 bucket region mismatch. Your bucket "${BUCKET_NAME}" is not in region "${process.env.AWS_REGION}". ` +
          "Please check your bucket's region in AWS Console and update AWS_REGION in .env.local"
        );
      }
      throw s3Error;
    }

    // Register artifact in database
    const [artifact] = await db
      .insert(rawArtifacts)
      .values({
        orgId,
        experimentId,
        sampleId: sampleId || null,
        storageKey,
        fileName: file.name,
        fileType: file.type,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        sha256,
        schemaVersion: schemaVersion || "v1",
      })
      .returning({ id: rawArtifacts.id });

    return NextResponse.json({
      success: true,
      data: { id: artifact.id, storageKey },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
