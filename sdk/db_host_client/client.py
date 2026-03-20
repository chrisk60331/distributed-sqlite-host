from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

import boto3
import httpx
from distributed_sqlite import create_engine
from sqlalchemy.engine import Engine

from db_host_client.models import DatabaseS3SessionResponse


def fetch_s3_session(
    *,
    api_key: str,
    api_base_url: Optional[str] = None,
    timeout: float = 60.0,
) -> DatabaseS3SessionResponse:
    base = (api_base_url or os.environ.get("DB_HOST_API_URL") or "").rstrip("/")
    if not base:
        raise ValueError("Set api_base_url or DB_HOST_API_URL")
    with httpx.Client(timeout=timeout) as client:
        r = client.post(
            f"{base}/databases/s3-session",
            json={"api_key": api_key},
        )
        r.raise_for_status()
        return DatabaseS3SessionResponse.model_validate(r.json())


@contextmanager
def connect(
    *,
    api_key: str,
    api_base_url: Optional[str] = None,
    cache_dir: Optional[Path] = None,
    timeout: float = 60.0,
) -> Iterator[Engine]:
    """
    Exchange ``api_key`` for STS-backed S3 credentials, then yield a SQLAlchemy
    engine for this tenant prefix. Uses ``boto3_session`` on the engine so process
    ``AWS_*`` environment variables are not modified.
    """
    session = fetch_s3_session(
        api_key=api_key, api_base_url=api_base_url, timeout=timeout
    )
    boto_sess = boto3.Session(
        aws_access_key_id=session.access_key_id,
        aws_secret_access_key=session.secret_access_key,
        aws_session_token=session.session_token,
        region_name=session.region,
    )
    url = f"distributed_sqlite+distributed_sqlite:///{session.bucket}/{session.prefix}"
    engine = create_engine(
        url,
        endpoint_url=session.endpoint_url,
        cache_dir=cache_dir,
        boto3_session=boto_sess,
    )
    try:
        yield engine
    finally:
        engine.dispose()
