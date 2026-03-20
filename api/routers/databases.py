import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

import bcrypt
import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Response, status
from starlette.concurrency import run_in_threadpool

import storage
from deps import CurrentUser
from models import (
    CreateDatabaseRequest,
    CreateDatabaseResponse,
    DatabaseExecuteRequest,
    DatabaseExecuteResponse,
    DatabaseExecuteStepResult,
    DatabaseRecord,
    DatabaseResponse,
    DatabaseS3SessionRequest,
    DatabaseS3SessionResponse,
    MintApiKeyResponse,
)
from s3_sts import assume_tenant_s3_session

router = APIRouter(prefix="/databases", tags=["databases"])

S3_BUCKET = os.getenv("S3_BUCKET", "db-host-databases")
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL")  # set for LocalStack
S3_ASSUMABLE_ROLE_ARN = (os.getenv("DB_HOST_S3_ASSUMABLE_ROLE_ARN") or "").strip()
STS_DURATION_SECONDS = int(os.getenv("DB_HOST_STS_DURATION_SECONDS", "3600"))


def _s3_client():
    kwargs: dict = dict(region_name=AWS_REGION)
    if AWS_ENDPOINT_URL:
        kwargs["endpoint_url"] = AWS_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def _ensure_bucket(s3, bucket: str) -> None:
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchBucket"):
            if AWS_REGION == "us-east-1":
                s3.create_bucket(Bucket=bucket)
            else:
                s3.create_bucket(
                    Bucket=bucket,
                    CreateBucketConfiguration={"LocationConstraint": AWS_REGION},
                )
        else:
            raise


def _public_api_base_url() -> str:
    base = (os.getenv("PUBLIC_API_BASE_URL") or os.getenv("NEXT_PUBLIC_API_URL") or "").strip()
    if not base:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: set PUBLIC_API_BASE_URL (or NEXT_PUBLIC_API_URL) "
            "so downloaded .env files contain the API URL.",
        )
    return base.rstrip("/")


def _build_response(rec: DatabaseRecord) -> DatabaseResponse:
    return DatabaseResponse(
        db_id=rec.db_id,
        name=rec.name,
        bucket=rec.bucket,
        prefix=rec.prefix,
        region=rec.region,
        created_at=rec.created_at,
    )


def _mint_api_key() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    digest = bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    return raw, digest


def _json_sql_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _execute_statements_sync(
    rec: DatabaseRecord, statements: list[str]
) -> list[DatabaseExecuteStepResult | None]:
    from distributed_sqlite import create_engine
    from sqlalchemy import text

    url = f"distributed_sqlite+distributed_sqlite:///{rec.bucket}/{rec.prefix}"
    endpoint = rec.endpoint_url or AWS_ENDPOINT_URL
    engine = create_engine(url=url, endpoint_url=endpoint)
    steps: list[DatabaseExecuteStepResult | None] = []
    with engine.begin() as conn:
        for stmt in statements:
            result = conn.execute(text(stmt))
            if result.returns_rows:
                cols = list(result.keys())
                rows = [
                    [_json_sql_cell(c) for c in row] for row in result.fetchall()
                ]
                steps.append(DatabaseExecuteStepResult(columns=cols, rows=rows))
            else:
                steps.append(None)
    return steps


def _build_env_content(rec: DatabaseRecord) -> str:
    api_base = _public_api_base_url()
    lines = [
        "# db-host — keep this file secret",
        "# Execute SQL via API (JWT) — no AWS variables required for this path.",
        f"DB_HOST_API_URL={api_base}",
        f"DB_HOST_DATABASE_ID={rec.db_id}",
        "",
        "# JWT from POST /auth/signin (same token as the dashboard).",
        "DB_HOST_TOKEN=",
        "",
        "# Direct S3 / distributed-sqlite: mint an API key in the dashboard (shown once on create,",
        "# or POST /databases/{id}/api-key with Bearer). Then use db-host-client:",
        "#   pip install path/to/sdk  # or publish to an index",
        "#   with connect(api_key=\"...\", api_base_url=os.environ[\"DB_HOST_API_URL\"]) as engine:",
        "#       ...",
        "DB_HOST_DATABASE_API_KEY=",
        "",
        "# POST {DB_HOST_API_URL}/databases/{DB_HOST_DATABASE_ID}/execute",
        "# Authorization: Bearer $DB_HOST_TOKEN",
        '# Body: {"statements":["SELECT 1"]}',
    ]
    return "\n".join(lines) + "\n"


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[DatabaseResponse])
async def list_databases(user: CurrentUser) -> list[DatabaseResponse]:
    records = await storage.list_databases_for_user(user["sub"])
    return [_build_response(r) for r in records]


@router.post("", response_model=CreateDatabaseResponse, status_code=status.HTTP_201_CREATED)
async def create_database(body: CreateDatabaseRequest, user: CurrentUser) -> CreateDatabaseResponse:
    user_id = user["sub"]
    db_id = str(uuid.uuid4())
    prefix = f"{user_id}/{body.name}"
    api_key, api_key_hash = _mint_api_key()

    s3 = _s3_client()
    _ensure_bucket(s3, S3_BUCKET)
    # Seed the prefix so it's visibly present in S3
    s3.put_object(Bucket=S3_BUCKET, Key=f"{prefix}/.db-host-init", Body=b"")

    record = DatabaseRecord(
        db_id=db_id,
        user_id=user_id,
        name=body.name,
        bucket=S3_BUCKET,
        prefix=prefix,
        region=AWS_REGION,
        endpoint_url=AWS_ENDPOINT_URL,
        created_at=datetime.now(timezone.utc).isoformat(),
        api_key_hash=api_key_hash,
    )
    await storage.create_database(record)
    base = _build_response(record)
    return CreateDatabaseResponse(**base.model_dump(), api_key=api_key)


@router.get("/{db_id}", response_model=DatabaseResponse)
async def get_database(db_id: str, user: CurrentUser) -> DatabaseResponse:
    rec = await storage.get_database(db_id, user["sub"])
    if not rec:
        raise HTTPException(status_code=404, detail="Database not found")
    return _build_response(rec)


@router.post("/s3-session", response_model=DatabaseS3SessionResponse)
async def issue_s3_session(body: DatabaseS3SessionRequest) -> DatabaseS3SessionResponse:
    if not S3_ASSUMABLE_ROLE_ARN:
        raise HTTPException(
            status_code=503,
            detail="S3 credential broker misconfigured: set DB_HOST_S3_ASSUMABLE_ROLE_ARN",
        )
    rec = await storage.get_database_by_api_key(body.api_key)
    if not rec or not rec.api_key_hash:
        raise HTTPException(status_code=401, detail="Invalid API key")
    try:
        return await run_in_threadpool(
            assume_tenant_s3_session,
            record=rec,
            role_arn=S3_ASSUMABLE_ROLE_ARN,
            duration_seconds=STS_DURATION_SECONDS,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/{db_id}/api-key", response_model=MintApiKeyResponse)
async def mint_database_api_key(db_id: str, user: CurrentUser) -> MintApiKeyResponse:
    rec = await storage.get_database(db_id, user["sub"])
    if not rec:
        raise HTTPException(status_code=404, detail="Database not found")
    api_key, api_key_hash = _mint_api_key()
    updated = await storage.update_database_api_key_hash(
        db_id, user["sub"], api_key_hash
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Database not found")
    return MintApiKeyResponse(api_key=api_key)


@router.post("/{db_id}/execute", response_model=DatabaseExecuteResponse)
async def execute_database_script(
    db_id: str, body: DatabaseExecuteRequest, user: CurrentUser
) -> DatabaseExecuteResponse:
    rec = await storage.get_database(db_id, user["sub"])
    if not rec:
        raise HTTPException(status_code=404, detail="Database not found")
    s3 = _s3_client()
    _ensure_bucket(s3, rec.bucket)
    try:
        steps = await run_in_threadpool(
            _execute_statements_sync, rec, list(body.statements)
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Execute failed: {e}",
        ) from e
    return DatabaseExecuteResponse(steps=steps)


@router.get("/{db_id}/env", response_class=Response)
async def download_env(db_id: str, user: CurrentUser) -> Response:
    rec = await storage.get_database(db_id, user["sub"])
    if not rec:
        raise HTTPException(status_code=404, detail="Database not found")
    content = _build_env_content(rec)
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{rec.name}.env"'},
    )


@router.delete("/{db_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_database(db_id: str, user: CurrentUser) -> None:
    deleted = await storage.delete_database(db_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Database not found")
