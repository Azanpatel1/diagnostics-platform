"""Database connection and queries for the worker."""

from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import json

from .config import get_settings


def get_engine():
    """Create SQLAlchemy engine with connection pooling."""
    settings = get_settings()
    return create_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )


def get_session():
    """Create a new database session."""
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


@contextmanager
def db_session():
    """Context manager for database sessions."""
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_artifact(artifact_id: str, org_id: str) -> Optional[dict]:
    """Fetch artifact by ID, verifying org_id."""
    with db_session() as session:
        result = session.execute(
            text("""
                SELECT id, org_id, experiment_id, sample_id, storage_key, 
                       file_name, file_type, sha256, schema_version, created_at
                FROM raw_artifacts
                WHERE id = :artifact_id AND org_id = :org_id
            """),
            {"artifact_id": artifact_id, "org_id": org_id}
        )
        row = result.fetchone()
        if row:
            return {
                "id": str(row.id),
                "org_id": str(row.org_id),
                "experiment_id": str(row.experiment_id),
                "sample_id": str(row.sample_id) if row.sample_id else None,
                "storage_key": row.storage_key,
                "file_name": row.file_name,
                "file_type": row.file_type,
                "sha256": row.sha256,
                "schema_version": row.schema_version,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        return None


def get_or_create_feature_set(org_id: str, name: str = "core_v1", version: str = "1.0.0") -> str:
    """Get or create a feature set, returning its ID."""
    feature_list = {
        "timeseries": [
            "baseline_mean", "baseline_std", "y_max", "y_min", 
            "t_at_max", "auc", "slope_early", "t_halfmax", "snr"
        ],
        "endpoint": ["endpoint_value"],
        "global": ["num_channels", "signal_quality_flag"]
    }
    
    with db_session() as session:
        # Try to get existing
        result = session.execute(
            text("""
                SELECT id FROM feature_sets
                WHERE org_id = :org_id AND name = :name
            """),
            {"org_id": org_id, "name": name}
        )
        row = result.fetchone()
        if row:
            return str(row.id)
        
        # Create new
        result = session.execute(
            text("""
                INSERT INTO feature_sets (org_id, name, version, feature_list)
                VALUES (:org_id, :name, :version, :feature_list)
                RETURNING id
            """),
            {
                "org_id": org_id,
                "name": name,
                "version": version,
                "feature_list": json.dumps(feature_list)
            }
        )
        row = result.fetchone()
        return str(row.id)


def upsert_sample_features(
    org_id: str,
    sample_id: str,
    feature_set_id: str,
    artifact_id: str,
    features: dict
) -> str:
    """Upsert sample features, returning the record ID."""
    with db_session() as session:
        # Check if exists
        result = session.execute(
            text("""
                SELECT id FROM sample_features
                WHERE sample_id = :sample_id AND feature_set_id = :feature_set_id
            """),
            {"sample_id": sample_id, "feature_set_id": feature_set_id}
        )
        existing = result.fetchone()
        
        if existing:
            # Update
            session.execute(
                text("""
                    UPDATE sample_features
                    SET features = :features,
                        artifact_id = :artifact_id,
                        computed_at = :computed_at
                    WHERE id = :id
                """),
                {
                    "id": str(existing.id),
                    "features": json.dumps(features),
                    "artifact_id": artifact_id,
                    "computed_at": datetime.now(timezone.utc)
                }
            )
            return str(existing.id)
        else:
            # Insert
            result = session.execute(
                text("""
                    INSERT INTO sample_features 
                    (org_id, sample_id, feature_set_id, artifact_id, features, computed_at)
                    VALUES (:org_id, :sample_id, :feature_set_id, :artifact_id, :features, :computed_at)
                    RETURNING id
                """),
                {
                    "org_id": org_id,
                    "sample_id": sample_id,
                    "feature_set_id": feature_set_id,
                    "artifact_id": artifact_id,
                    "features": json.dumps(features),
                    "computed_at": datetime.now(timezone.utc)
                }
            )
            row = result.fetchone()
            return str(row.id)


def update_job_status(
    job_id: str,
    status: str,
    output: Optional[dict] = None,
    error: Optional[str] = None
) -> None:
    """Update job status."""
    with db_session() as session:
        session.execute(
            text("""
                UPDATE jobs
                SET status = :status,
                    output = :output,
                    error = :error,
                    updated_at = :updated_at
                WHERE id = :job_id
            """),
            {
                "job_id": job_id,
                "status": status,
                "output": json.dumps(output) if output else None,
                "error": error,
                "updated_at": datetime.now(timezone.utc)
            }
        )


def get_job(job_id: str) -> Optional[dict]:
    """Get a job by ID."""
    with db_session() as session:
        result = session.execute(
            text("""
                SELECT id, org_id, type, status, input, output, error, 
                       created_at, updated_at
                FROM jobs
                WHERE id = :job_id
            """),
            {"job_id": job_id}
        )
        row = result.fetchone()
        if row:
            return {
                "id": str(row.id),
                "org_id": str(row.org_id),
                "type": row.type,
                "status": row.status,
                "input": row.input,
                "output": row.output,
                "error": row.error,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        return None
