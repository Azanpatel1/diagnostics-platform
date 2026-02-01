"""Configuration for the worker service."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str
    
    # Redis (Upstash)
    upstash_redis_rest_url: str
    upstash_redis_rest_token: str
    
    # AWS S3
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "us-west-1"
    aws_s3_bucket: str
    
    # Worker settings
    poll_interval_seconds: float = 1.0
    max_retries: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
