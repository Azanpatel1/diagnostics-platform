"""Endpoint JSON extractor for v1_endpoint_json schema."""

from typing import Optional, Dict, Any, List
import json

from .base import BaseExtractor, ExtractionResult
from .core_v1 import compute_endpoint_features, compute_global_features


class EndpointJSONExtractor(BaseExtractor):
    """
    Extractor for v1_endpoint_json schema.
    
    Expected JSON format:
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
    
    Required fields:
        - channels: array of objects with "channel" (string) and "value" (number)
    
    Optional fields:
        - metadata: object with additional information
    """
    
    @property
    def schema_version(self) -> str:
        return "v1_endpoint_json"
    
    def validate(self, content: str) -> tuple[bool, Optional[str]]:
        """Validate the JSON content matches expected schema."""
        try:
            data = json.loads(content)
            
            # Must be an object
            if not isinstance(data, dict):
                return False, "JSON root must be an object"
            
            # Must have channels array
            if "channels" not in data:
                return False, "Missing required field 'channels'"
            
            channels = data["channels"]
            if not isinstance(channels, list):
                return False, "Field 'channels' must be an array"
            
            if len(channels) == 0:
                return False, "Field 'channels' must have at least one entry"
            
            # Validate each channel entry
            for i, ch in enumerate(channels):
                if not isinstance(ch, dict):
                    return False, f"Channel entry {i} must be an object"
                
                if "channel" not in ch:
                    return False, f"Channel entry {i} missing 'channel' field"
                
                if "value" not in ch:
                    return False, f"Channel entry {i} missing 'value' field"
                
                if not isinstance(ch["channel"], str):
                    return False, f"Channel entry {i} 'channel' must be a string"
                
                if not isinstance(ch["value"], (int, float)):
                    return False, f"Channel entry {i} 'value' must be a number"
            
            return True, None
            
        except json.JSONDecodeError as e:
            return False, f"JSON parsing error: {str(e)}"
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def extract(self, content: str) -> ExtractionResult:
        """Extract features from the endpoint JSON."""
        # First validate
        is_valid, error = self.validate(content)
        if not is_valid:
            return ExtractionResult.failure(error or "Validation failed")
        
        try:
            data = json.loads(content)
            channels_data = data["channels"]
            
            # Sort channels by name for determinism
            channels_data = sorted(channels_data, key=lambda x: x["channel"])
            
            # Compute features for each channel
            all_features: Dict[str, Any] = {}
            channel_names: List[str] = []
            
            for ch in channels_data:
                channel_name = ch["channel"]
                value = ch["value"]
                channel_names.append(channel_name)
                
                channel_features = compute_endpoint_features(channel_name, value)
                all_features.update(channel_features)
            
            # Compute global features
            global_features = compute_global_features(all_features, channel_names)
            all_features.update(global_features)
            
            # Include metadata if present
            if "metadata" in data and isinstance(data["metadata"], dict):
                for key, value in data["metadata"].items():
                    all_features[f"metadata.{key}"] = value
            
            return ExtractionResult.from_features(all_features)
            
        except Exception as e:
            return ExtractionResult.failure(f"Extraction error: {str(e)}")
