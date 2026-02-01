import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Organizations table
export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Organization members table
export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: text("role").notNull().default("member"), // 'owner', 'admin', 'member'
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.clerkUserId] }),
  })
);

// Experiments table
export const experiments = pgTable("experiments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  protocolVersion: text("protocol_version"),
  instrumentId: text("instrument_id"),
  operator: text("operator"),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Samples table
export const samples = pgTable("samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  experimentId: uuid("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  sampleLabel: text("sample_label").notNull(),
  patientPseudonym: text("patient_pseudonym"),
  matrixType: text("matrix_type"),
  collectedAt: timestamp("collected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Raw artifacts table
export const rawArtifacts = pgTable("raw_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  experimentId: uuid("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  sampleId: uuid("sample_id").references(() => samples.id, {
    onDelete: "set null",
  }),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: text("file_size"),
  sha256: text("sha256").notNull(),
  schemaVersion: text("schema_version").notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// PHASE 2: Feature Engineering Tables
// ============================================

// Feature sets table - defines versioned feature configurations
export const featureSets = pgTable("feature_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "core_v1"
  version: text("version").notNull(), // e.g., "1.0.0"
  featureList: jsonb("feature_list").notNull(), // array of feature names
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Sample features table - stores computed features for samples
export const sampleFeatures = pgTable(
  "sample_features",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    sampleId: uuid("sample_id")
      .notNull()
      .references(() => samples.id, { onDelete: "cascade" }),
    featureSetId: uuid("feature_set_id")
      .notNull()
      .references(() => featureSets.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id").references(() => rawArtifacts.id, {
      onDelete: "set null",
    }),
    features: jsonb("features").notNull(), // computed feature values
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Unique constraint for upsert on recompute
    uniqueSampleFeatureSet: unique().on(table.sampleId, table.featureSetId),
  })
);

// Jobs table - tracks async job execution
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // e.g., "extract_features"
  status: text("status").notNull().default("queued"), // queued, running, succeeded, failed
  input: jsonb("input"), // job parameters
  output: jsonb("output"), // result data
  error: text("error"), // error message if failed
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const orgsRelations = relations(orgs, ({ many }) => ({
  members: many(orgMembers),
  experiments: many(experiments),
  samples: many(samples),
  artifacts: many(rawArtifacts),
  featureSets: many(featureSets),
  sampleFeatures: many(sampleFeatures),
  jobs: many(jobs),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(orgs, {
    fields: [orgMembers.orgId],
    references: [orgs.id],
  }),
}));

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  org: one(orgs, {
    fields: [experiments.orgId],
    references: [orgs.id],
  }),
  samples: many(samples),
  artifacts: many(rawArtifacts),
}));

export const samplesRelations = relations(samples, ({ one, many }) => ({
  org: one(orgs, {
    fields: [samples.orgId],
    references: [orgs.id],
  }),
  experiment: one(experiments, {
    fields: [samples.experimentId],
    references: [experiments.id],
  }),
  artifacts: many(rawArtifacts),
  features: many(sampleFeatures),
}));

export const rawArtifactsRelations = relations(rawArtifacts, ({ one, many }) => ({
  org: one(orgs, {
    fields: [rawArtifacts.orgId],
    references: [orgs.id],
  }),
  experiment: one(experiments, {
    fields: [rawArtifacts.experimentId],
    references: [experiments.id],
  }),
  sample: one(samples, {
    fields: [rawArtifacts.sampleId],
    references: [samples.id],
  }),
  sampleFeatures: many(sampleFeatures),
}));

// Phase 2 relations
export const featureSetsRelations = relations(featureSets, ({ one, many }) => ({
  org: one(orgs, {
    fields: [featureSets.orgId],
    references: [orgs.id],
  }),
  sampleFeatures: many(sampleFeatures),
}));

export const sampleFeaturesRelations = relations(sampleFeatures, ({ one }) => ({
  org: one(orgs, {
    fields: [sampleFeatures.orgId],
    references: [orgs.id],
  }),
  sample: one(samples, {
    fields: [sampleFeatures.sampleId],
    references: [samples.id],
  }),
  featureSet: one(featureSets, {
    fields: [sampleFeatures.featureSetId],
    references: [featureSets.id],
  }),
  artifact: one(rawArtifacts, {
    fields: [sampleFeatures.artifactId],
    references: [rawArtifacts.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  org: one(orgs, {
    fields: [jobs.orgId],
    references: [orgs.id],
  }),
}));

// Type exports
export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;

export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;

export type Sample = typeof samples.$inferSelect;
export type NewSample = typeof samples.$inferInsert;

export type RawArtifact = typeof rawArtifacts.$inferSelect;
export type NewRawArtifact = typeof rawArtifacts.$inferInsert;

// Phase 2 types
export type FeatureSet = typeof featureSets.$inferSelect;
export type NewFeatureSet = typeof featureSets.$inferInsert;

export type SampleFeature = typeof sampleFeatures.$inferSelect;
export type NewSampleFeature = typeof sampleFeatures.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

// Job status enum
export const JobStatus = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;

export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];
