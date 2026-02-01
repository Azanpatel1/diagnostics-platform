"""Base extractor interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class ExtractionResult:
    """Result of feature extraction."""
    success: bool
    features: Dict[str, Any]
    num_features: int
    error: Optional[str] = None
    
    @classmethod
    def failure(cls, error: str) -> "ExtractionResult":
        """Create a failure result."""
        return cls(success=False, features={}, num_features=0, error=error)
    
    @classmethod
    def from_features(cls, features: Dict[str, Any]) -> "ExtractionResult":
        """Create a success result from features."""
        # Count total features (including nested channel features)
        count = 0
        for key, value in features.items():
            if isinstance(value, dict):
                count += len(value)
            else:
                count += 1
        return cls(success=True, features=features, num_features=count)


class BaseExtractor(ABC):
    """Base class for feature extractors."""
    
    @property
    @abstractmethod
    def schema_version(self) -> str:
        """The schema version this extractor handles."""
        pass
    
    @abstractmethod
    def validate(self, content: str) -> tuple[bool, Optional[str]]:
        """
        Validate the content matches the expected schema.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        pass
    
    @abstractmethod
    def extract(self, content: str) -> ExtractionResult:
        """
        Extract features from the content.
        
        Returns:
            ExtractionResult with computed features or error
        """
        pass
