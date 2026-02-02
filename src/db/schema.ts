import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  jsonb,
  unique,
  doublePrecision,
  boolean,
  integer,
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
  type: text("type").notNull(), // e.g., "extract_features", "predict_xgboost"
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

// ============================================
// PHASE 3: ML Model Registry & Predictions
// ============================================

// Model registry table - stores versioned model bundles
export const modelRegistry = pgTable(
  "model_registry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "sepsis_classifier"
    version: text("version").notNull(), // e.g., "1.0.0"
    task: text("task").notNull(), // e.g., "binary_classification"
    featureSetId: uuid("feature_set_id")
      .notNull()
      .references(() => featureSets.id, { onDelete: "restrict" }),
    storageKey: text("storage_key").notNull(), // S3 key to model bundle zip
    modelFormat: text("model_format").notNull().default("xgboost_json"), // xgboost_json, xgboost_ubj
    metrics: jsonb("metrics"), // training metrics, e.g., { auc: 0.95, accuracy: 0.92 }
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Unique constraint: one version per model name per org
    uniqueOrgNameVersion: unique().on(table.orgId, table.name, table.version),
  })
);

// Predictions table - stores inference results
export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    sampleId: uuid("sample_id")
      .notNull()
      .references(() => samples.id, { onDelete: "cascade" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => modelRegistry.id, { onDelete: "cascade" }),
    yHat: doublePrecision("y_hat").notNull(), // predicted probability
    threshold: doublePrecision("threshold").notNull(), // decision threshold used
    predictedClass: integer("predicted_class").notNull(), // 0 or 1
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Unique constraint for upsert on re-run
    uniqueSampleModel: unique().on(table.sampleId, table.modelId),
  })
);

// Leaf embeddings table - stores XGBoost leaf indices
export const leafEmbeddings = pgTable(
  "leaf_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    sampleId: uuid("sample_id")
      .notNull()
      .references(() => samples.id, { onDelete: "cascade" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => modelRegistry.id, { onDelete: "cascade" }),
    leafIndices: jsonb("leaf_indices").notNull(), // array of leaf indices per tree
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Unique constraint for upsert on re-run
    uniqueSampleModelLeaf: unique().on(table.sampleId, table.modelId),
  })
);

// Relations
export const orgsRelations = relations(orgs, ({ many }) => ({
  members: many(orgMembers),
  experiments: many(experiments),
  samples: many(samples),
  artifacts: many(rawArtifacts),
  featureSets: many(featureSets),
  sampleFeatures: many(sampleFeatures),
  jobs: many(jobs),
  models: many(modelRegistry),
  predictions: many(predictions),
  leafEmbeddings: many(leafEmbeddings),
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
  predictions: many(predictions),
  leafEmbeddings: many(leafEmbeddings),
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
  models: many(modelRegistry),
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

// Phase 3 relations
export const modelRegistryRelations = relations(modelRegistry, ({ one, many }) => ({
  org: one(orgs, {
    fields: [modelRegistry.orgId],
    references: [orgs.id],
  }),
  featureSet: one(featureSets, {
    fields: [modelRegistry.featureSetId],
    references: [featureSets.id],
  }),
  predictions: many(predictions),
  leafEmbeddings: many(leafEmbeddings),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  org: one(orgs, {
    fields: [predictions.orgId],
    references: [orgs.id],
  }),
  sample: one(samples, {
    fields: [predictions.sampleId],
    references: [samples.id],
  }),
  model: one(modelRegistry, {
    fields: [predictions.modelId],
    references: [modelRegistry.id],
  }),
}));

export const leafEmbeddingsRelations = relations(leafEmbeddings, ({ one }) => ({
  org: one(orgs, {
    fields: [leafEmbeddings.orgId],
    references: [orgs.id],
  }),
  sample: one(samples, {
    fields: [leafEmbeddings.sampleId],
    references: [samples.id],
  }),
  model: one(modelRegistry, {
    fields: [leafEmbeddings.modelId],
    references: [modelRegistry.id],
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

// Phase 3 types
export type ModelRegistry = typeof modelRegistry.$inferSelect;
export type NewModelRegistry = typeof modelRegistry.$inferInsert;

export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;

export type LeafEmbedding = typeof leafEmbeddings.$inferSelect;
export type NewLeafEmbedding = typeof leafEmbeddings.$inferInsert;

// Model task types
export const ModelTask = {
  BINARY_CLASSIFICATION: "binary_classification",
  MULTICLASS_CLASSIFICATION: "multiclass_classification",
  REGRESSION: "regression",
} as const;

export type ModelTaskType = (typeof ModelTask)[keyof typeof ModelTask];

// Model format types
export const ModelFormat = {
  XGBOOST_JSON: "xgboost_json",
  XGBOOST_UBJ: "xgboost_ubj",
} as const;

export type ModelFormatType = (typeof ModelFormat)[keyof typeof ModelFormat];
