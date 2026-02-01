import { z } from "zod";

// Experiment schemas
export const createExperimentSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  protocolVersion: z.string().max(100).optional(),
  instrumentId: z.string().max(100).optional(),
  operator: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
  startedAt: z.string().datetime().optional().or(z.literal("")),
});

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;

// Sample schemas
export const createSampleSchema = z.object({
  experimentId: z.string().uuid("Invalid experiment ID"),
  sampleLabel: z.string().min(1, "Sample label is required").max(255),
  patientPseudonym: z.string().max(255).optional(),
  matrixType: z.string().max(100).optional(),
  collectedAt: z.string().datetime().optional().or(z.literal("")),
});

export type CreateSampleInput = z.infer<typeof createSampleSchema>;

// Artifact schemas
export const registerArtifactSchema = z.object({
  experimentId: z.string().uuid("Invalid experiment ID"),
  sampleId: z.string().uuid("Invalid sample ID").optional(),
  storageKey: z.string().min(1, "Storage key is required"),
  fileName: z.string().min(1, "File name is required").max(500),
  fileType: z.string().min(1, "File type is required").max(100),
  fileSize: z.string().optional(),
  sha256: z
    .string()
    .length(64, "SHA-256 hash must be 64 characters")
    .regex(/^[a-f0-9]+$/i, "Invalid SHA-256 hash"),
  schemaVersion: z.string().max(50).optional().default("v1"),
});

export type RegisterArtifactInput = z.infer<typeof registerArtifactSchema>;

// Upload URL request schema
export const getUploadUrlSchema = z.object({
  experimentId: z.string().uuid("Invalid experiment ID"),
  fileName: z.string().min(1, "File name is required").max(500),
  contentType: z
    .string()
    .min(1, "Content type is required")
    .refine(
      (type) =>
        type === "text/csv" ||
        type === "application/json" ||
        type === "application/vnd.ms-excel",
      "Only CSV and JSON files are allowed"
    ),
});

export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>;
