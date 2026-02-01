"""Redis queue consumer for processing jobs."""

import asyncio
import json
import logging
import traceback
from typing import Optional
from datetime import datetime

from upstash_redis import Redis

from .config import get_settings
from .db import (
    get_artifact,
    get_or_create_feature_set,
    upsert_sample_features,
    update_job_status,
    get_job,
)
from .s3 import download_file_as_string
from .extractors import TimeseriesCSVExtractor, EndpointJSONExtractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Queue name
JOBS_QUEUE = "jobs:default"

# Schema version to extractor mapping
EXTRACTORS = {
    "v1_timeseries_csv": TimeseriesCSVExtractor(),
    "v1_endpoint_json": EndpointJSONExtractor(),
}


def get_redis_client() -> Redis:
    """Create Upstash Redis client."""
    settings = get_settings()
    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    )


def process_extract_features_job(job_data: dict) -> None:
    """
    Process a feature extraction job.
    
    Args:
        job_data: Job payload from Redis queue
    """
    job_id = job_data.get("job_id")
    org_id = job_data.get("org_id")
    artifact_id = job_data.get("artifact_id")
    feature_set_name = job_data.get("feature_set", "core_v1")
    
    logger.info(f"Processing job {job_id} for artifact {artifact_id}")
    
    try:
        # Set job status to running
        update_job_status(job_id, "running")
        
        # Fetch artifact and verify org_id
        artifact = get_artifact(artifact_id, org_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found or org mismatch")
        
        sample_id = artifact.get("sample_id")
        if not sample_id:
            raise ValueError("Artifact is not attached to a sample")
        
        storage_key = artifact["storage_key"]
        schema_version = artifact["schema_version"]
        
        logger.info(f"Artifact schema version: {schema_version}")
        
        # Get or create feature set
        feature_set_id = get_or_create_feature_set(org_id, feature_set_name)
        
        # Download file from S3
        logger.info(f"Downloading file from S3: {storage_key}")
        content = download_file_as_string(storage_key)
        
        # Select extractor based on schema version
        extractor = EXTRACTORS.get(schema_version)
        if not extractor:
            raise ValueError(
                f"Unsupported schema version: {schema_version}. "
                f"Supported versions: {', '.join(EXTRACTORS.keys())}"
            )
        
        # Extract features
        logger.info(f"Extracting features using {extractor.schema_version} extractor")
        result = extractor.extract(content)
        
        if not result.success:
            raise ValueError(f"Feature extraction failed: {result.error}")
        
        # Upsert features to database
        logger.info(f"Storing {result.num_features} features for sample {sample_id}")
        feature_record_id = upsert_sample_features(
            org_id=org_id,
            sample_id=sample_id,
            feature_set_id=feature_set_id,
            artifact_id=artifact_id,
            features=result.features,
        )
        
        # Update job status to succeeded
        output = {
            "sample_id": sample_id,
            "feature_set": feature_set_name,
            "num_features": result.num_features,
            "feature_record_id": feature_record_id,
        }
        update_job_status(job_id, "succeeded", output=output)
        
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        error_msg = str(e)
        tb = traceback.format_exc()
        logger.error(f"Job {job_id} failed: {error_msg}\n{tb}")
        
        # Update job status to failed
        update_job_status(job_id, "failed", error=f"{error_msg}\n\n{tb[:500]}")


def process_job(job_data: dict) -> None:
    """
    Process a job based on its type.
    
    Args:
        job_data: Job payload from Redis queue
    """
    job_type = job_data.get("type")
    
    if job_type == "extract_features":
        process_extract_features_job(job_data)
    else:
        logger.warning(f"Unknown job type: {job_type}")


async def run_consumer() -> None:
    """
    Run the Redis queue consumer.
    
    Polls the queue continuously and processes jobs.
    """
    settings = get_settings()
    redis = get_redis_client()
    
    logger.info(f"Starting consumer, polling queue: {JOBS_QUEUE}")
    logger.info(f"Poll interval: {settings.poll_interval_seconds}s")
    
    while True:
        try:
            # Pop from the right side of the queue (FIFO)
            message = redis.rpop(JOBS_QUEUE)
            
            if message:
                # Parse the job data
                if isinstance(message, bytes):
                    message = message.decode("utf-8")
                if isinstance(message, str):
                    job_data = json.loads(message)
                else:
                    job_data = message
                
                logger.info(f"Received job: {job_data.get('job_id')}")
                
                # Process the job (in a sync context for now)
                process_job(job_data)
            else:
                # No message, wait before polling again
                await asyncio.sleep(settings.poll_interval_seconds)
                
        except Exception as e:
            logger.error(f"Consumer error: {str(e)}")
            logger.error(traceback.format_exc())
            # Wait before retrying
            await asyncio.sleep(settings.poll_interval_seconds * 2)


def start_consumer() -> None:
    """Start the consumer in the event loop."""
    asyncio.run(run_consumer())
