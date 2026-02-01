# Diagnostics Platform

A secure, multi-tenant web application for managing diagnostic experiments, samples, and raw data files with automated feature extraction.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Authentication**: Clerk (with Organizations)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **File Storage**: AWS S3
- **Feature Extraction**: Synchronous (TypeScript)
- **UI**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Features

### Phase 1: Core Data Platform
- Multi-tenant organization support via Clerk
- Create and manage experiments
- Create samples within experiments
- Upload raw data files (CSV/JSON) with SHA-256 integrity verification
- Complete data isolation between organizations
- Direct-to-S3 file uploads with presigned URLs

### Phase 2: Deterministic Feature Engineering
- Automated feature extraction from raw artifacts
- Support for v1_timeseries_csv and v1_endpoint_json schemas
- Synchronous feature extraction (no external worker required)
- Deterministic feature extraction (same input → same output)
- Per-channel and global feature computation

## Getting Started

### Prerequisites

- Node.js 18+
- A Clerk account with Organizations enabled
- A Neon PostgreSQL database
- An AWS S3 bucket

### Environment Setup

1. Copy the environment example file:

```bash
cp .env.local.example .env.local
```

2. Fill in your credentials:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/experiments
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/experiments

# Neon PostgreSQL
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### Installation

```bash
npm install
```

### Database Setup

Generate and run migrations:

```bash
npm run db:generate
npm run db:push
```

### Clerk Webhook Setup

1. In your Clerk Dashboard, go to Webhooks
2. Create a new webhook endpoint pointing to: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to the following events:
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
4. Copy the Signing Secret to `CLERK_WEBHOOK_SECRET`

### S3 Bucket Setup

1. Create an S3 bucket
2. Configure CORS for direct uploads:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

3. Create an IAM user with S3 access and add credentials to `.env.local`

### Development

Start the Next.js development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

Feature extraction happens synchronously when you click "Extract Features" on an artifact - no external worker or Redis required.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard pages
│   │   ├── experiments/   # Experiment management
│   │   └── samples/       # Sample management
│   └── api/               # API routes (webhooks)
├── actions/               # Server Actions
│   ├── experiments.ts     # Experiment CRUD
│   ├── samples.ts         # Sample CRUD
│   ├── artifacts.ts       # File upload/download
│   ├── jobs.ts            # Job queue management (Phase 2)
│   └── features.ts        # Feature retrieval (Phase 2)
├── components/            # React components
│   ├── experiments/       # Experiment components
│   ├── samples/           # Sample components
│   ├── artifacts/         # File upload components
│   ├── jobs/              # Job status components (Phase 2)
│   ├── features/          # Feature display (Phase 2)
│   └── ui/                # shadcn/ui components
├── db/                    # Database
│   ├── schema.ts          # Drizzle schema (includes Phase 2 tables)
│   └── index.ts           # Database client
├── lib/                   # Utilities
│   ├── auth.ts            # Auth context helper
│   ├── extractors.ts      # Feature extraction algorithms (Phase 2)
│   ├── s3.ts              # S3 utilities
│   ├── utils.ts           # General utilities
│   └── validations.ts     # Zod schemas
└── middleware.ts          # Clerk middleware
```

## Security

### Multi-Tenant Data Isolation

Every database query includes `org_id` filtering:

```typescript
const { orgId } = await getAuthContext();

// All queries filter by org_id
const experiments = await db.query.experiments.findMany({
  where: eq(experiments.orgId, orgId),
});
```

### File Storage Isolation

Files are stored with org-scoped keys:

```
{orgId}/artifacts/{experimentId}/{uuid}-{filename}
```

### Authentication Flow

1. User authenticates via Clerk
2. User selects/creates an organization
3. `getAuthContext()` retrieves and validates org membership
4. All subsequent actions are scoped to that organization

## Phase 1 Success Criteria

- [x] Two different Clerk organizations can exist
- [x] Each organization can create experiments
- [x] Each organization can create samples
- [x] Each organization can upload raw CSV/JSON files
- [x] Organizations cannot see each other's data
- [x] All data is persisted in Neon PostgreSQL
- [x] Files are stored in S3 with valid pointers
- [x] SHA-256 hash stored for every file
- [x] schema_version defaults to "v1"

## Phase 2: Data Contracts

### v1_timeseries_csv

CSV format for time-series data:

```csv
channel,t,y
IL6,0.0,12.1
IL6,0.5,12.6
IL6,1.0,13.2
CRP,0.0,3.2
CRP,0.5,3.4
```

### v1_endpoint_json

JSON format for endpoint measurements:

```json
{
  "channels": [
    {"channel": "IL6", "value": 123.4},
    {"channel": "CRP", "value": 55.1}
  ],
  "metadata": {
    "instrument_id": "NEXT-001",
    "temperature_c": 23.5
  }
}
```

## Phase 2: Computed Features (core_v1)

### Time-Series Features (per channel)

| Feature | Description |
|---------|-------------|
| `baseline_mean` | Mean of y over first 10% of samples |
| `baseline_std` | Standard deviation over first 10% |
| `y_max` | Maximum signal value |
| `y_min` | Minimum signal value |
| `t_at_max` | Time at maximum (first occurrence) |
| `auc` | Area under curve (trapezoidal integral) |
| `slope_early` | Linear regression slope over first 20% |
| `t_halfmax` | First t where y >= halfmax threshold |
| `snr` | Signal-to-noise ratio |

### Endpoint Features (per channel)

| Feature | Description |
|---------|-------------|
| `endpoint_value` | The provided measurement value |

### Global Features

| Feature | Description |
|---------|-------------|
| `num_channels` | Total number of channels |
| `signal_quality_flag` | "ok" or "low" based on SNR/baseline |

## Phase 2 Success Criteria

- [x] Upload v1_timeseries_csv artifact → extract features → sample_features created
- [x] Upload v1_endpoint_json artifact → extract features → sample_features created
- [x] Invalid schema produces job failed with clear error
- [x] Re-running extraction upserts features deterministically
- [x] Two orgs cannot access each other's jobs/features/artifacts
- [x] UI shows job progress and resulting features

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

## License

Private - All rights reserved
