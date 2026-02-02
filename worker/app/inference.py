"""XGBoost inference with leaf embedding extraction."""

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import xgboost as xgb

from .models import LoadedModel, ModelConfig


@dataclass
class PredictionResult:
    """Result of a single prediction."""
    
    sample_id: str
    model_id: str
    y_hat: float
    threshold: float
    predicted_class: int
    leaf_indices: List[int]
    num_trees: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "sample_id": self.sample_id,
            "model_id": self.model_id,
            "y_hat": self.y_hat,
            "threshold": self.threshold,
            "predicted_class": self.predicted_class,
            "leaf_indices": self.leaf_indices,
            "num_trees": self.num_trees,
        }


class InferenceError(Exception):
    """Error during inference."""
    pass


def construct_feature_vector(
    features: Dict[str, Any],
    feature_order: List[str],
) -> np.ndarray:
    """
    Construct a feature vector in the correct order for the model.
    
    Missing features are set to NaN so XGBoost can use its built-in
    missing value handling (routing based on training data).
    
    Args:
        features: Dictionary of feature_name -> feature_value
        feature_order: Ordered list of feature names expected by model
        
    Returns:
        numpy array of feature values in correct order
    """
    vector = []
    for feature_name in feature_order:
        if feature_name in features:
            value = features[feature_name]
            # Handle None values as NaN
            if value is None:
                vector.append(np.nan)
            else:
                try:
                    vector.append(float(value))
                except (ValueError, TypeError):
                    # Non-numeric values treated as missing
                    vector.append(np.nan)
        else:
            # Missing feature -> NaN
            vector.append(np.nan)
    
    return np.array(vector, dtype=np.float32)


def run_inference(
    loaded_model: LoadedModel,
    sample_id: str,
    model_id: str,
    features: Dict[str, Any],
    threshold_override: Optional[float] = None,
) -> PredictionResult:
    """
    Run XGBoost inference on a single sample.
    
    Args:
        loaded_model: Loaded model with booster and config
        sample_id: UUID of the sample
        model_id: UUID of the model
        features: Dictionary of computed features for the sample
        threshold_override: Optional threshold to use instead of default
        
    Returns:
        PredictionResult with probability, class, and leaf indices
        
    Raises:
        InferenceError: If inference fails
    """
    try:
        # Construct feature vector
        feature_vector = construct_feature_vector(
            features=features,
            feature_order=loaded_model.config.feature_order,
        )
        
        # Create DMatrix for XGBoost
        # Reshape to (1, n_features) for single sample
        dmatrix = xgb.DMatrix(
            feature_vector.reshape(1, -1),
            feature_names=loaded_model.config.feature_order,
        )
        
        # Get probability prediction
        y_hat_raw = loaded_model.model.predict(dmatrix)
        y_hat = float(y_hat_raw[0])
        
        # Ensure y_hat is valid
        if math.isnan(y_hat) or math.isinf(y_hat):
            raise InferenceError(f"Invalid prediction value: {y_hat}")
        
        # Get leaf indices for embedding
        leaf_indices_raw = loaded_model.model.predict(
            dmatrix, pred_leaf=True
        )
        # Convert to list of Python ints
        leaf_indices = leaf_indices_raw[0].astype(int).tolist()
        
        # Determine threshold and class
        threshold = (
            threshold_override 
            if threshold_override is not None 
            else loaded_model.config.default_threshold
        )
        predicted_class = 1 if y_hat >= threshold else 0
        
        return PredictionResult(
            sample_id=sample_id,
            model_id=model_id,
            y_hat=y_hat,
            threshold=threshold,
            predicted_class=predicted_class,
            leaf_indices=leaf_indices,
            num_trees=loaded_model.num_trees,
        )
        
    except xgb.core.XGBoostError as e:
        raise InferenceError(f"XGBoost prediction failed: {e}")
    except Exception as e:
        raise InferenceError(f"Inference failed: {e}")


def run_batch_inference(
    loaded_model: LoadedModel,
    model_id: str,
    samples: List[Tuple[str, Dict[str, Any]]],  # List of (sample_id, features)
    threshold_override: Optional[float] = None,
) -> List[PredictionResult]:
    """
    Run XGBoost inference on a batch of samples.
    
    This is more efficient than running single predictions in a loop
    because it batches the XGBoost predict calls.
    
    Args:
        loaded_model: Loaded model with booster and config
        model_id: UUID of the model
        samples: List of (sample_id, features) tuples
        threshold_override: Optional threshold to use instead of default
        
    Returns:
        List of PredictionResult objects
        
    Raises:
        InferenceError: If inference fails
    """
    if not samples:
        return []
    
    try:
        # Construct feature matrix
        feature_vectors = []
        sample_ids = []
        
        for sample_id, features in samples:
            vector = construct_feature_vector(
                features=features,
                feature_order=loaded_model.config.feature_order,
            )
            feature_vectors.append(vector)
            sample_ids.append(sample_id)
        
        # Stack into matrix
        feature_matrix = np.vstack(feature_vectors)
        
        # Create DMatrix
        dmatrix = xgb.DMatrix(
            feature_matrix,
            feature_names=loaded_model.config.feature_order,
        )
        
        # Get probability predictions
        y_hats = loaded_model.model.predict(dmatrix)
        
        # Get leaf indices
        leaf_indices_matrix = loaded_model.model.predict(dmatrix, pred_leaf=True)
        
        # Determine threshold
        threshold = (
            threshold_override 
            if threshold_override is not None 
            else loaded_model.config.default_threshold
        )
        
        # Build results
        results = []
        for i, sample_id in enumerate(sample_ids):
            y_hat = float(y_hats[i])
            leaf_indices = leaf_indices_matrix[i].astype(int).tolist()
            predicted_class = 1 if y_hat >= threshold else 0
            
            results.append(PredictionResult(
                sample_id=sample_id,
                model_id=model_id,
                y_hat=y_hat,
                threshold=threshold,
                predicted_class=predicted_class,
                leaf_indices=leaf_indices,
                num_trees=loaded_model.num_trees,
            ))
        
        return results
        
    except xgb.core.XGBoostError as e:
        raise InferenceError(f"XGBoost batch prediction failed: {e}")
    except Exception as e:
        raise InferenceError(f"Batch inference failed: {e}")
