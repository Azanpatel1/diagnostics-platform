"""Model bundle loading and caching utilities."""

import json
import tempfile
import zipfile
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import xgboost as xgb

from .s3 import download_file


@dataclass
class ModelConfig:
    """Model configuration from model_config.json."""
    
    feature_set: str
    feature_order: List[str]
    task: str
    default_threshold: float
    notes: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelConfig":
        """Create ModelConfig from dictionary."""
        return cls(
            feature_set=data["feature_set"],
            feature_order=data["feature_order"],
            task=data["task"],
            default_threshold=data.get("default_threshold", 0.5),
            notes=data.get("notes"),
        )


@dataclass
class LoadedModel:
    """A loaded XGBoost model with its configuration."""
    
    model: xgb.Booster
    config: ModelConfig
    num_trees: int
    
    @property
    def feature_names(self) -> List[str]:
        """Get ordered feature names for this model."""
        return self.config.feature_order


class ModelBundleError(Exception):
    """Error loading or parsing a model bundle."""
    pass


def load_model_bundle(storage_key: str) -> LoadedModel:
    """
    Download and load a model bundle from S3.
    
    Bundle must contain:
    - xgb_model.json or xgb_model.ubj (XGBoost model file)
    - model_config.json (model configuration)
    
    Args:
        storage_key: S3 key to the model bundle zip
        
    Returns:
        LoadedModel with XGBoost booster and configuration
        
    Raises:
        ModelBundleError: If bundle is invalid or missing required files
    """
    try:
        # Download bundle from S3
        bundle_bytes = download_file(storage_key)
        bundle_io = BytesIO(bundle_bytes)
        
        # Extract and load from zip
        with zipfile.ZipFile(bundle_io, "r") as zf:
            # List files in bundle
            file_names = zf.namelist()
            
            # Find model file (prefer JSON over UBJ)
            model_file = None
            model_format = None
            
            if "xgb_model.json" in file_names:
                model_file = "xgb_model.json"
                model_format = "json"
            elif "xgb_model.ubj" in file_names:
                model_file = "xgb_model.ubj"
                model_format = "ubj"
            else:
                raise ModelBundleError(
                    "Model bundle must contain xgb_model.json or xgb_model.ubj"
                )
            
            # Check for config file
            if "model_config.json" not in file_names:
                raise ModelBundleError(
                    "Model bundle must contain model_config.json"
                )
            
            # Load model config
            config_bytes = zf.read("model_config.json")
            config_data = json.loads(config_bytes.decode("utf-8"))
            
            # Validate required config fields
            required_fields = ["feature_set", "feature_order", "task"]
            missing_fields = [f for f in required_fields if f not in config_data]
            if missing_fields:
                raise ModelBundleError(
                    f"model_config.json missing required fields: {missing_fields}"
                )
            
            config = ModelConfig.from_dict(config_data)
            
            # Load XGBoost model
            # XGBoost requires a file path, so we need to write to temp file
            model_bytes = zf.read(model_file)
            
            with tempfile.NamedTemporaryFile(
                suffix=f".{model_format}", delete=False
            ) as tmp:
                tmp.write(model_bytes)
                tmp.flush()
                tmp_path = tmp.name
            
            try:
                booster = xgb.Booster()
                booster.load_model(tmp_path)
            finally:
                # Clean up temp file
                Path(tmp_path).unlink(missing_ok=True)
            
            # Get number of trees
            num_trees = _get_num_trees(booster)
            
            return LoadedModel(
                model=booster,
                config=config,
                num_trees=num_trees,
            )
            
    except zipfile.BadZipFile:
        raise ModelBundleError("Invalid model bundle: not a valid zip file")
    except json.JSONDecodeError as e:
        raise ModelBundleError(f"Invalid model_config.json: {e}")
    except xgb.core.XGBoostError as e:
        raise ModelBundleError(f"Failed to load XGBoost model: {e}")


def _get_num_trees(booster: xgb.Booster) -> int:
    """Get the number of trees in an XGBoost booster."""
    # Get model dump and count trees
    try:
        # num_boosted_rounds() returns the number of boosting rounds
        return booster.num_boosted_rounds()
    except Exception:
        # Fallback: parse from model config
        try:
            config = json.loads(booster.save_config())
            return int(config.get("learner", {}).get("gradient_booster", {})
                      .get("gbtree_train_param", {}).get("num_trees", 0))
        except Exception:
            return 0


# Simple in-memory cache for loaded models
# Key: (org_id, model_id), Value: LoadedModel
_model_cache: Dict[str, LoadedModel] = {}


def get_cached_model(model_id: str, storage_key: str) -> LoadedModel:
    """
    Get a model from cache or load it.
    
    Args:
        model_id: UUID of the model (used as cache key)
        storage_key: S3 key to model bundle
        
    Returns:
        LoadedModel instance
    """
    if model_id not in _model_cache:
        _model_cache[model_id] = load_model_bundle(storage_key)
    return _model_cache[model_id]


def invalidate_model_cache(model_id: Optional[str] = None) -> None:
    """
    Invalidate model cache.
    
    Args:
        model_id: Specific model to invalidate, or None to clear all
    """
    global _model_cache
    if model_id is None:
        _model_cache = {}
    elif model_id in _model_cache:
        del _model_cache[model_id]


def validate_model_bundle(storage_key: str) -> Dict[str, Any]:
    """
    Validate a model bundle without fully loading it.
    
    Returns metadata about the bundle if valid.
    
    Args:
        storage_key: S3 key to the model bundle zip
        
    Returns:
        Dictionary with bundle metadata
        
    Raises:
        ModelBundleError: If bundle is invalid
    """
    try:
        bundle_bytes = download_file(storage_key)
        bundle_io = BytesIO(bundle_bytes)
        
        with zipfile.ZipFile(bundle_io, "r") as zf:
            file_names = zf.namelist()
            
            # Check for required files
            has_json = "xgb_model.json" in file_names
            has_ubj = "xgb_model.ubj" in file_names
            has_config = "model_config.json" in file_names
            
            if not (has_json or has_ubj):
                raise ModelBundleError(
                    "Bundle missing model file (xgb_model.json or xgb_model.ubj)"
                )
            
            if not has_config:
                raise ModelBundleError("Bundle missing model_config.json")
            
            # Parse config
            config_bytes = zf.read("model_config.json")
            config_data = json.loads(config_bytes.decode("utf-8"))
            
            return {
                "valid": True,
                "model_format": "json" if has_json else "ubj",
                "config": config_data,
                "files": file_names,
            }
            
    except zipfile.BadZipFile:
        raise ModelBundleError("Invalid model bundle: not a valid zip file")
    except json.JSONDecodeError as e:
        raise ModelBundleError(f"Invalid model_config.json: {e}")
