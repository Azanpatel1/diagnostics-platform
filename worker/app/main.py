"""FastAPI application for the ML worker service."""

import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from .config import get_settings
from .consumer import start_consumer, process_job
from .db import get_job
from .routes import predict_router


# Background consumer thread
consumer_thread: Optional[threading.Thread] = None


def check_xgboost_available() -> bool:
    """Check if XGBoost is available."""
    try:
        import xgboost
        return True
    except ImportError:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - starts consumer on startup."""
    global consumer_thread
    
    # Start the consumer in a background thread
    consumer_thread = threading.Thread(target=start_consumer, daemon=True)
    consumer_thread.start()
    
    print("Worker started - consumer running in background")
    
    yield
    
    # Cleanup on shutdown
    print("Worker shutting down")


app = FastAPI(
    title="Diagnostics ML Worker",
    description="ML worker service for feature extraction and XGBoost inference",
    version="2.0.0",
    lifespan=lifespan,
)

# Register prediction routes
app.include_router(predict_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    settings = get_settings()
    xgboost_available = check_xgboost_available()
    
    return {
        "status": "healthy",
        "service": "ml-worker",
        "version": "2.0.0",
        "capabilities": {
            "feature_extraction": True,
            "xgboost_inference": xgboost_available,
        },
        "config": {
            "redis_configured": bool(settings.upstash_redis_rest_url),
            "database_configured": bool(settings.database_url),
            "s3_configured": bool(settings.aws_s3_bucket),
        }
    }


class RunOnceRequest(BaseModel):
    """Request body for manual job execution."""
    job_id: str
    type: str = "extract_features"
    org_id: str
    artifact_id: str
    feature_set: str = "core_v1"


@app.post("/internal/run-once")
async def run_once(request: RunOnceRequest):
    """
    Manually trigger a single job for debugging.
    
    This bypasses the queue and runs the job directly.
    """
    try:
        job_data = {
            "job_id": request.job_id,
            "type": request.type,
            "org_id": request.org_id,
            "artifact_id": request.artifact_id,
            "feature_set": request.feature_set,
        }
        
        # Process the job directly
        process_job(job_data)
        
        # Get the updated job status
        job = get_job(request.job_id)
        
        return {
            "success": True,
            "job": job,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
