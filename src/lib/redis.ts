import { Redis } from "@upstash/redis";

// Lazy-initialized Redis client to prevent build-time errors
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    if (
      !process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
      );
    }
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

// Export a proxy that lazily initializes the Redis client
export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const client = getRedis();
    const value = client[prop as keyof typeof client];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

// Queue name for jobs
export const JOBS_QUEUE = "jobs:default";

// Job payload type
export interface JobPayload {
  job_id: string;
  type: "extract_features";
  org_id: string;
  artifact_id: string;
  feature_set: string;
}

/**
 * Push a job to the Redis queue
 */
export async function enqueueJob(payload: JobPayload): Promise<void> {
  await redis.lpush(JOBS_QUEUE, JSON.stringify(payload));
}

/**
 * Get the length of the job queue
 */
export async function getQueueLength(): Promise<number> {
  return await redis.llen(JOBS_QUEUE);
}
