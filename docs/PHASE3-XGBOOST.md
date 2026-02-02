# Phase 3: XGBoost Inference + Leaf Embeddings

This document describes how to set up and use the XGBoost inference system introduced in Phase 3.

## Overview

Phase 3 adds ML model management and synchronous XGBoost inference capabilities:

- **Model Registry**: Store versioned XGBoost model bundles with metadata
- **Predictions**: Run inference on samples with extracted features
- **Leaf Embeddings**: Extract leaf indices for similarity analysis (future UMAP/DBSCAN)

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Next.js UI        │────▶│   Next.js API       │────▶│   Python ML Service │
│   /models           │     │   /api/samples/     │     │   FastAPI           │
│   /experiments/[id] │     │   [id]/predict      │     │   /v1/predict-      │
│   /samples/[id]     │     │                     │     │   xgboost           │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                      │                          │
                                      │                          │
                                      ▼                          ▼
                            ┌─────────────────────┐     ┌─────────────────────┐
                            │   Neon PostgreSQL   │     │   S3 Object Storage │
                            │   - model_registry  │     │   - Model bundles   │
                            │   - predictions     │     │                     │
                            │   - leaf_embeddings │     │                     │
                            └─────────────────────┘     └─────────────────────┘
```

## Database Schema

### model_registry

Stores versioned model bundles:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization FK |
| name | text | Model name (e.g., "sepsis_classifier") |
| version | text | Version string (e.g., "1.0.0") |
| task | text | Task type (e.g., "binary_classification") |
| feature_set_id | uuid | Required feature set FK |
| storage_key | text | S3 key to model bundle |
| model_format | text | Format (xgboost_json, xgboost_ubj) |
| metrics | jsonb | Training metrics |
| is_active | boolean | Active model flag |
| created_at | timestamptz | Creation timestamp |

**Constraints:**
- Unique: (org_id, name, version)
- Only one active model per (org_id, task) enforced in application logic

### predictions

Stores inference results:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization FK |
| sample_id | uuid | Sample FK |
| model_id | uuid | Model FK |
| y_hat | double precision | Predicted probability |
| threshold | double precision | Decision threshold used |
| predicted_class | int | 0 or 1 |
| created_at | timestamptz | Prediction timestamp |

**Constraints:**
- Unique: (sample_id, model_id) - supports upsert on re-run

### leaf_embeddings

Stores XGBoost leaf indices:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization FK |
| sample_id | uuid | Sample FK |
| model_id | uuid | Model FK |
| leaf_indices | jsonb | Array of leaf indices |
| created_at | timestamptz | Creation timestamp |

**Constraints:**
- Unique: (sample_id, model_id) - supports upsert on re-run

## Model Bundle Specification

Models are stored as zip bundles in S3. Each bundle must contain:

### Required Files

1. **xgb_model.json** or **xgb_model.ubj**
   - XGBoost model file in native JSON or UBJ format
   - Trained using `xgb.Booster.save_model()`

2. **model_config.json**
   - Model configuration with required fields:

```json
{
  "feature_set": "core_v1",
  "feature_order": [
    "channel.IL6.auc",
    "channel.IL6.snr",
    "channel.TNF.auc",
    "channel.TNF.snr"
  ],
  "task": "binary_classification",
  "default_threshold": 0.5,
  "notes": "Baseline sepsis classifier v1"
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| feature_set | Yes | Name of the feature set (e.g., "core_v1") |
| feature_order | Yes | Exact ordering of features for inference |
| task | Yes | Task type ("binary_classification", "multiclass_classification", "regression") |
| default_threshold | No | Decision threshold (default: 0.5) |
| notes | No | Human-readable description |

### Creating a Model Bundle

```python
import xgboost as xgb
import json
import zipfile

# Train your model
model = xgb.XGBClassifier()
model.fit(X_train, y_train)

# Save model file
model.get_booster().save_model("xgb_model.json")

# Create config
config = {
    "feature_set": "core_v1",
    "feature_order": list(X_train.columns),
    "task": "binary_classification",
    "default_threshold": 0.5,
    "notes": "My trained model"
}

with open("model_config.json", "w") as f:
    json.dump(config, f, indent=2)

# Create bundle
with zipfile.ZipFile("model_bundle.zip", "w") as zf:
    zf.write("xgb_model.json")
    zf.write("model_config.json")
```

## Python ML Service Setup

### Environment Variables

Add to `worker/.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=diagnostics-platform

# Redis (optional, for queue consumer)
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx
```

### Local Development

```bash
cd worker

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn app.main:app --reload --port 8000
```

### Docker

```bash
cd worker
docker build -t ml-worker .
docker run -p 8000:8000 --env-file .env ml-worker
```

### API Endpoints

#### Health Check
```
GET /health

Response:
{
  "status": "healthy",
  "service": "ml-worker",
  "version": "2.0.0",
  "capabilities": {
    "feature_extraction": true,
    "xgboost_inference": true
  }
}
```

#### Single Prediction
```
POST /v1/predict-xgboost

Request:
{
  "org_id": "<uuid>",
  "sample_id": "<uuid>",
  "model_id": "<uuid>"
}

Response:
{
  "status": "ok",
  "sample_id": "<uuid>",
  "model_id": "<uuid>",
  "y_hat": 0.873,
  "threshold": 0.5,
  "predicted_class": 1,
  "num_trees": 500
}
```

#### Batch Prediction
```
POST /v1/predict-xgboost-batch

Request:
{
  "org_id": "<uuid>",
  "model_id": "<uuid>",
  "sample_ids": ["<uuid>", "<uuid>", ...]
}

Response:
{
  "status": "ok",
  "model_id": "<uuid>",
  "total_samples": 10,
  "successful": 9,
  "failed": 1,
  "results": [...],
  "errors": [...]
}
```

## Next.js Configuration

Add to `.env.local`:

```bash
# ML Service URL
ML_SERVICE_URL=http://localhost:8000
```

For production, point to your deployed ML service:

```bash
ML_SERVICE_URL=https://ml-worker.your-domain.com
```

## UI Features

### Models Page (/models)

Admin/owner only page for model management:

- Upload model bundle (zip)
- Register model with name, version, task, feature set
- Activate/deactivate models (one active per task)
- Delete models (with cascade delete of predictions)

### Experiment Detail

- Shows prediction status for each sample
- "Run Prediction" button per sample
- "Predict All" button for batch prediction
- Displays predicted class and probability

### Sample Detail

- Prediction tab with:
  - Probability, threshold, predicted class
  - Model name/version used
  - Prediction timestamp
- Leaf embedding debug section:
  - Number of trees
  - First 20 leaf indices preview
  - Copy full array button

## Security

1. **Multi-tenancy**: All queries filter by org_id
2. **Defense in depth**: Python service independently verifies org ownership
3. **Role-based access**: Model management requires admin/owner role
4. **S3 key validation**: Storage keys validated against org ownership

## Missing Feature Handling

When a sample is missing features required by the model:

1. Missing features are set to `NaN`
2. XGBoost uses its built-in missing value routing
3. Predictions remain deterministic (same input → same output)

## Acceptance Tests

1. **Model Registration**: Register model bundle, verify in registry
2. **Single Prediction**: Predict sample, verify predictions + leaf_embeddings rows
3. **Batch Prediction**: Predict experiment, verify all samples processed
4. **Determinism**: Re-run prediction, outputs identical, no duplicate rows
5. **Org Isolation**: Org B cannot access Org A's models or predictions
6. **Missing Features**: Sample with missing features still predicts
