"""S3 utilities for downloading files."""

import boto3
from io import BytesIO
from typing import Union

from .config import get_settings


def get_s3_client():
    """Create S3 client."""
    settings = get_settings()
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def download_file(storage_key: str) -> bytes:
    """Download a file from S3 by storage key."""
    settings = get_settings()
    client = get_s3_client()
    
    buffer = BytesIO()
    client.download_fileobj(settings.aws_s3_bucket, storage_key, buffer)
    buffer.seek(0)
    
    return buffer.read()


def download_file_as_string(storage_key: str, encoding: str = "utf-8") -> str:
    """Download a file from S3 and return as string."""
    content = download_file(storage_key)
    return content.decode(encoding)
