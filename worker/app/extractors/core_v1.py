"""Core v1 feature computation - deterministic feature extraction.

All computations are deterministic:
- Same input → same output
- No random seeds
- Fixed numeric tolerances
- Ordering does not affect computation
"""

from typing import Dict, List, Any, Optional
import numpy as np
from scipy import integrate


def compute_timeseries_features(
    t: np.ndarray, 
    y: np.ndarray,
    channel: str
) -> Dict[str, Any]:
    """
    Compute features for a single channel's time-series data.
    
    Args:
        t: Time values (seconds)
        y: Signal values
        channel: Channel name for feature key prefixing
        
    Returns:
        Dictionary of features with keys like "channel.<CHANNEL>.baseline_mean"
    """
    if len(t) == 0 or len(y) == 0:
        return _empty_channel_features(channel)
    
    # Sort by time to ensure deterministic ordering
    sorted_indices = np.argsort(t)
    t = t[sorted_indices]
    y = y[sorted_indices]
    
    n = len(y)
    
    # Baseline calculations (first 10% of samples)
    baseline_n = max(1, int(n * 0.1))
    baseline_y = y[:baseline_n]
    baseline_mean = float(np.mean(baseline_y))
    baseline_std = float(np.std(baseline_y, ddof=0))  # Population std for determinism
    
    # Basic statistics
    y_max = float(np.max(y))
    y_min = float(np.min(y))
    
    # Time at max (first occurrence)
    max_idx = int(np.argmax(y))
    t_at_max = float(t[max_idx])
    
    # AUC - trapezoidal integral
    auc = float(integrate.trapezoid(y, t))
    
    # Slope early - linear regression over first 20% of points
    early_n = max(2, int(n * 0.2))
    early_t = t[:early_n]
    early_y = y[:early_n]
    
    if len(early_t) >= 2:
        # Deterministic linear regression using numpy
        coeffs = np.polyfit(early_t, early_y, 1)
        slope_early = float(coeffs[0])
    else:
        slope_early = 0.0
    
    # t_halfmax - first t where y >= baseline_mean + 0.5*(y_max - baseline_mean)
    halfmax_threshold = baseline_mean + 0.5 * (y_max - baseline_mean)
    t_halfmax: Optional[float] = None
    for i, yi in enumerate(y):
        if yi >= halfmax_threshold:
            t_halfmax = float(t[i])
            break
    
    # SNR - signal to noise ratio
    snr = (y_max - baseline_mean) / max(baseline_std, 1e-9)
    
    # Build feature dictionary with stable keys
    prefix = f"channel.{channel}"
    return {
        f"{prefix}.baseline_mean": baseline_mean,
        f"{prefix}.baseline_std": baseline_std,
        f"{prefix}.y_max": y_max,
        f"{prefix}.y_min": y_min,
        f"{prefix}.t_at_max": t_at_max,
        f"{prefix}.auc": auc,
        f"{prefix}.slope_early": slope_early,
        f"{prefix}.t_halfmax": t_halfmax,
        f"{prefix}.snr": float(snr),
    }


def _empty_channel_features(channel: str) -> Dict[str, Any]:
    """Return empty features for a channel with no data."""
    prefix = f"channel.{channel}"
    return {
        f"{prefix}.baseline_mean": None,
        f"{prefix}.baseline_std": None,
        f"{prefix}.y_max": None,
        f"{prefix}.y_min": None,
        f"{prefix}.t_at_max": None,
        f"{prefix}.auc": None,
        f"{prefix}.slope_early": None,
        f"{prefix}.t_halfmax": None,
        f"{prefix}.snr": None,
    }


def compute_endpoint_features(
    channel: str,
    value: float
) -> Dict[str, Any]:
    """
    Compute features for an endpoint JSON channel.
    
    Args:
        channel: Channel name
        value: The endpoint value
        
    Returns:
        Dictionary with endpoint_value feature
    """
    prefix = f"channel.{channel}"
    return {
        f"{prefix}.endpoint_value": float(value),
    }


def compute_global_features(
    channel_features: Dict[str, Any],
    channels: List[str],
    baseline_std_threshold: float = 10.0,
    snr_threshold: float = 3.0
) -> Dict[str, Any]:
    """
    Compute global/cross-channel features.
    
    Args:
        channel_features: All computed channel features
        channels: List of channel names
        baseline_std_threshold: Threshold for high baseline std
        snr_threshold: Threshold for low SNR
        
    Returns:
        Dictionary of global features
    """
    num_channels = len(channels)
    
    # Check signal quality
    low_quality = False
    for ch in channels:
        baseline_std = channel_features.get(f"channel.{ch}.baseline_std")
        snr = channel_features.get(f"channel.{ch}.snr")
        
        if baseline_std is not None and baseline_std > baseline_std_threshold:
            low_quality = True
            break
        if snr is not None and snr < snr_threshold:
            low_quality = True
            break
    
    return {
        "global.num_channels": num_channels,
        "global.signal_quality_flag": "low" if low_quality else "ok",
    }
