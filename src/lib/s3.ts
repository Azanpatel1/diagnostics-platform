import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

// URL expiration time in seconds (15 minutes for uploads)
const UPLOAD_URL_EXPIRATION = 15 * 60;
// URL expiration time for downloads (1 hour)
const DOWNLOAD_URL_EXPIRATION = 60 * 60;

/**
 * Generate a unique storage key for an artifact
 * Format: {orgId}/artifacts/{experimentId}/{uuid}-{sanitizedFilename}
 */
export function generateStorageKey(
  orgId: string,
  experimentId: string,
  fileName: string
): string {
  const uuid = crypto.randomUUID();
  const sanitizedFileName = sanitizeFileName(fileName);
  return `${orgId}/artifacts/${experimentId}/${uuid}-${sanitizedFileName}`;
}

/**
 * Sanitize a filename to be safe for S3 storage
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace unsafe chars with underscore
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .toLowerCase();
}

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(
  storageKey: string,
  contentType: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: UPLOAD_URL_EXPIRATION,
  });

  return { uploadUrl, storageKey };
}

/**
 * Generate a presigned URL for downloading a file from S3
 */
export async function generateDownloadUrl(
  storageKey: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRATION,
  });
}

/**
 * Delete a file from S3
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  });

  await s3Client.send(command);
}

/**
 * Validate that a storage key belongs to the specified organization
 * This is an important security check to prevent cross-tenant access
 */
export function validateStorageKeyOwnership(
  storageKey: string,
  orgId: string
): boolean {
  return storageKey.startsWith(`${orgId}/`);
}

/**
 * Get the content type based on file extension
 */
export function getContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    case "xls":
    case "xlsx":
      return "application/vnd.ms-excel";
    default:
      return "application/octet-stream";
  }
}

/**
 * Check if a file type is allowed for upload
 */
export function isAllowedFileType(contentType: string): boolean {
  const allowedTypes = [
    "text/csv",
    "application/json",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  return allowedTypes.includes(contentType);
}
