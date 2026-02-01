"""Timeseries CSV extractor for v1_timeseries_csv schema."""

from typing import Optional, Dict, Any, List
from io import StringIO
import pandas as pd
import numpy as np

from .base import BaseExtractor, ExtractionResult
from .core_v1 import compute_timeseries_features, compute_global_features


class TimeseriesCSVExtractor(BaseExtractor):
    """
    Extractor for v1_timeseries_csv schema.
    
    Expected CSV format:
        channel,t,y
        IL6,0.0,12.1
        IL6,0.5,12.6
        ...
        CRP,0.0,3.2
        ...
    
    Required columns:
        - channel: string - biomarker name / wavelength / sensor channel label
        - t: float - time in seconds (monotonic within each channel)
        - y: float - signal value (fluorescence/intensity/voltage)
    """
    
    REQUIRED_COLUMNS = {"channel", "t", "y"}
    
    @property
    def schema_version(self) -> str:
        return "v1_timeseries_csv"
    
    def validate(self, content: str) -> tuple[bool, Optional[str]]:
        """Validate the CSV content matches expected schema."""
        try:
            df = pd.read_csv(StringIO(content))
            
            # Check required columns exist
            missing = self.REQUIRED_COLUMNS - set(df.columns)
            if missing:
                return False, f"Missing required columns: {', '.join(missing)}"
            
            # Check for non-empty data
            if len(df) == 0:
                return False, "CSV file is empty (no data rows)"
            
            # Check column types
            # channel should be string-like
            if not pd.api.types.is_object_dtype(df["channel"]) and not pd.api.types.is_string_dtype(df["channel"]):
                return False, "Column 'channel' must be string type"
            
            # t and y should be numeric
            if not pd.api.types.is_numeric_dtype(df["t"]):
                # Try to convert
                try:
                    pd.to_numeric(df["t"])
                except (ValueError, TypeError):
                    return False, "Column 't' must be numeric (float)"
            
            if not pd.api.types.is_numeric_dtype(df["y"]):
                try:
                    pd.to_numeric(df["y"])
                except (ValueError, TypeError):
                    return False, "Column 'y' must be numeric (float)"
            
            return True, None
            
        except pd.errors.ParserError as e:
            return False, f"CSV parsing error: {str(e)}"
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def extract(self, content: str) -> ExtractionResult:
        """Extract features from the timeseries CSV."""
        # First validate
        is_valid, error = self.validate(content)
        if not is_valid:
            return ExtractionResult.failure(error or "Validation failed")
        
        try:
            df = pd.read_csv(StringIO(content))
            
            # Convert columns to proper types
            df["channel"] = df["channel"].astype(str)
            df["t"] = pd.to_numeric(df["t"], errors="coerce")
            df["y"] = pd.to_numeric(df["y"], errors="coerce")
            
            # Drop any rows with NaN values
            df = df.dropna(subset=["t", "y"])
            
            if len(df) == 0:
                return ExtractionResult.failure("No valid data after parsing")
            
            # Get unique channels (sorted for determinism)
            channels: List[str] = sorted(df["channel"].unique().tolist())
            
            # Compute features for each channel
            all_features: Dict[str, Any] = {}
            
            for channel in channels:
                channel_data = df[df["channel"] == channel].sort_values("t")
                t = channel_data["t"].to_numpy()
                y = channel_data["y"].to_numpy()
                
                channel_features = compute_timeseries_features(t, y, channel)
                all_features.update(channel_features)
            
            # Compute global features
            global_features = compute_global_features(all_features, channels)
            all_features.update(global_features)
            
            return ExtractionResult.from_features(all_features)
            
        except Exception as e:
            return ExtractionResult.failure(f"Extraction error: {str(e)}")
