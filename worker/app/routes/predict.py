"""XGBoost prediction endpoints."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import (
    get_model,
    get_sample,
    get_sample_features_by_feature_set,
    get_samples_for_experiment,
    upsert_prediction,
    upsert_leaf_embedding,
    create_predict_job,
    update_job_status,
)
from ..models import (
    get_cached_model,
    ModelBundleError,
)
from ..inference import (
    run_inference,
    run_batch_inference,
    InferenceError,
)


router = APIRouter(prefix="/v1", tags=["predictions"])


class PredictRequest(BaseModel):
    """Request for single sample prediction."""
    org_id: str
    sample_id: str
    model_id: str


class PredictBatchRequest(BaseModel):
    """Request for batch prediction."""
    org_id: str
    model_id: str
    sample_ids: List[str]


class PredictResponse(BaseModel):
    """Response for successful prediction."""
    status: str = "ok"
    sample_id: str
    model_id: str
    y_hat: float
    threshold: float
    predicted_class: int
    num_trees: int


class PredictBatchResponse(BaseModel):
    """Response for batch prediction."""
    status: str = "ok"
    model_id: str
    total_samples: int
    successful: int
    failed: int
    results: List[PredictResponse]
    errors: List[dict]


class ErrorResponse(BaseModel):
    """Response for errors."""
    status: str = "error"
    message: str
    details: Optional[str] = None


@router.post(
    "/predict-xgboost",
    response_model=PredictResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def predict_xgboost(request: PredictRequest):
    """
    Run XGBoost prediction on a single sample.
    
    This endpoint:
    1. Verifies model and sample belong to the org
    2. Loads the model bundle from S3
    3. Retrieves sample features
    4. Runs inference with leaf extraction
    5. Upserts prediction and leaf embedding to DB
    6. Returns prediction result
    """
    org_id = request.org_id
    sample_id = request.sample_id
    model_id = request.model_id
    
    job_id = None
    
    try:
        # Create job record for audit
        job_id = create_predict_job(org_id, sample_id, model_id)
        
        # 1. Verify and get model (defense in depth - verify org ownership)
        model = get_model(model_id, org_id)
        if not model:
            raise HTTPException(
                status_code=404,
                detail=ErrorResponse(
                    message="Model not found or access denied",
                    details=f"model_id={model_id}"
                ).model_dump()
            )
        
        # 2. Verify and get sample
        sample = get_sample(sample_id, org_id)
        if not sample:
            raise HTTPException(
                status_code=404,
                detail=ErrorResponse(
                    message="Sample not found or access denied",
                    details=f"sample_id={sample_id}"
                ).model_dump()
            )
        
        # 3. Get sample features for the model's feature set
        sample_features = get_sample_features_by_feature_set(
            sample_id=sample_id,
            feature_set_id=model["feature_set_id"],
            org_id=org_id,
        )
        
        if not sample_features:
            raise HTTPException(
                status_code=400,
                detail=ErrorResponse(
                    message="Sample features not found for required feature set",
                    details=f"sample_id={sample_id}, feature_set_id={model['feature_set_id']}"
                ).model_dump()
            )
        
        # 4. Load model bundle (uses cache)
        try:
            loaded_model = get_cached_model(model_id, model["storage_key"])
        except ModelBundleError as e:
            raise HTTPException(
                status_code=500,
                detail=ErrorResponse(
                    message="Failed to load model bundle",
                    details=str(e)
                ).model_dump()
            )
        
        # 5. Run inference
        try:
            result = run_inference(
                loaded_model=loaded_model,
                sample_id=sample_id,
                model_id=model_id,
                features=sample_features["features"],
            )
        except InferenceError as e:
            raise HTTPException(
                status_code=500,
                detail=ErrorResponse(
                    message="Inference failed",
                    details=str(e)
                ).model_dump()
            )
        
        # 6. Upsert prediction and leaf embedding
        upsert_prediction(
            org_id=org_id,
            sample_id=sample_id,
            model_id=model_id,
            y_hat=result.y_hat,
            threshold=result.threshold,
            predicted_class=result.predicted_class,
        )
        
        upsert_leaf_embedding(
            org_id=org_id,
            sample_id=sample_id,
            model_id=model_id,
            leaf_indices=result.leaf_indices,
        )
        
        # Update job as succeeded
        if job_id:
            update_job_status(
                job_id=job_id,
                status="succeeded",
                output={
                    "y_hat": result.y_hat,
                    "threshold": result.threshold,
                    "predicted_class": result.predicted_class,
                    "num_trees": result.num_trees,
                }
            )
        
        return PredictResponse(
            status="ok",
            sample_id=sample_id,
            model_id=model_id,
            y_hat=result.y_hat,
            threshold=result.threshold,
            predicted_class=result.predicted_class,
            num_trees=result.num_trees,
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        if job_id:
            update_job_status(job_id=job_id, status="failed", error="HTTP error")
        raise
    except Exception as e:
        # Log and return generic error
        if job_id:
            update_job_status(job_id=job_id, status="failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                message="Prediction failed",
                details=str(e)
            ).model_dump()
        )


@router.post(
    "/predict-xgboost-batch",
    response_model=PredictBatchResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def predict_xgboost_batch(request: PredictBatchRequest):
    """
    Run XGBoost prediction on multiple samples.
    
    This endpoint processes samples in batch for efficiency.
    Individual sample failures don't fail the entire batch.
    """
    org_id = request.org_id
    model_id = request.model_id
    sample_ids = request.sample_ids
    
    if not sample_ids:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                message="No sample IDs provided"
            ).model_dump()
        )
    
    # 1. Verify and get model
    model = get_model(model_id, org_id)
    if not model:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                message="Model not found or access denied",
                details=f"model_id={model_id}"
            ).model_dump()
        )
    
    # 2. Load model bundle
    try:
        loaded_model = get_cached_model(model_id, model["storage_key"])
    except ModelBundleError as e:
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                message="Failed to load model bundle",
                details=str(e)
            ).model_dump()
        )
    
    # 3. Collect samples and their features
    samples_to_predict = []
    errors = []
    
    for sample_id in sample_ids:
        # Verify sample
        sample = get_sample(sample_id, org_id)
        if not sample:
            errors.append({
                "sample_id": sample_id,
                "error": "Sample not found or access denied"
            })
            continue
        
        # Get features
        sample_features = get_sample_features_by_feature_set(
            sample_id=sample_id,
            feature_set_id=model["feature_set_id"],
            org_id=org_id,
        )
        
        if not sample_features:
            errors.append({
                "sample_id": sample_id,
                "error": "Features not found for required feature set"
            })
            continue
        
        samples_to_predict.append((sample_id, sample_features["features"]))
    
    # 4. Run batch inference
    results = []
    
    if samples_to_predict:
        try:
            prediction_results = run_batch_inference(
                loaded_model=loaded_model,
                model_id=model_id,
                samples=samples_to_predict,
            )
            
            # 5. Upsert results and build response
            for result in prediction_results:
                try:
                    upsert_prediction(
                        org_id=org_id,
                        sample_id=result.sample_id,
                        model_id=model_id,
                        y_hat=result.y_hat,
                        threshold=result.threshold,
                        predicted_class=result.predicted_class,
                    )
                    
                    upsert_leaf_embedding(
                        org_id=org_id,
                        sample_id=result.sample_id,
                        model_id=model_id,
                        leaf_indices=result.leaf_indices,
                    )
                    
                    results.append(PredictResponse(
                        status="ok",
                        sample_id=result.sample_id,
                        model_id=model_id,
                        y_hat=result.y_hat,
                        threshold=result.threshold,
                        predicted_class=result.predicted_class,
                        num_trees=result.num_trees,
                    ))
                except Exception as e:
                    errors.append({
                        "sample_id": result.sample_id,
                        "error": f"Failed to save prediction: {str(e)}"
                    })
                    
        except InferenceError as e:
            # Batch inference failed entirely
            raise HTTPException(
                status_code=500,
                detail=ErrorResponse(
                    message="Batch inference failed",
                    details=str(e)
                ).model_dump()
            )
    
    return PredictBatchResponse(
        status="ok",
        model_id=model_id,
        total_samples=len(sample_ids),
        successful=len(results),
        failed=len(errors),
        results=results,
        errors=errors,
    )
