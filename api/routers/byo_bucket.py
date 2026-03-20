"""BYO (Bring Your Own) bucket endpoints.

Flow:
  1. GET  /byo-bucket/setup   → generate ExternalId, return CF launch URL
  2. POST /byo-bucket/connect → user submits role_arn + bucket_name; we validate by
                                assuming the role and listing the bucket
  3. GET  /byo-bucket/config  → current validated config
  4. DELETE /byo-bucket/config → remove config (existing DBs retain stored fields)
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, status
from starlette.concurrency import run_in_threadpool

import storage
from deps import CurrentUser
from models import (
    BYOBucketConfig,
    BYOBucketConnectRequest,
    BYOBucketConnectResponse,
    BYOBucketSetupResponse,
)
from s3_sts import assume_byo_role, get_platform_account_id

router = APIRouter(prefix="/byo-bucket", tags=["byo-bucket"])

_CF_TEMPLATE_URL = (os.getenv("BYO_BUCKET_CF_TEMPLATE_URL") or "").strip()
_AWS_ENDPOINT_URL = (os.getenv("AWS_ENDPOINT_URL") or "").strip() or None
_AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

# Cached so we don't call STS on every request
_platform_account_id: str | None = None


def _get_account_id() -> str:
    global _platform_account_id
    if _platform_account_id:
        return _platform_account_id
    env_id = (os.getenv("DB_HOST_AWS_ACCOUNT_ID") or "").strip()
    if env_id:
        _platform_account_id = env_id
        return _platform_account_id
    _platform_account_id = get_platform_account_id(endpoint_url=_AWS_ENDPOINT_URL)
    return _platform_account_id


def _build_cf_launch_url(*, external_id: str, account_id: str) -> str | None:
    if not _CF_TEMPLATE_URL:
        return None
    params = urlencode({
        "templateURL": _CF_TEMPLATE_URL,
        "stackName": "db-host-byo-bucket",
        "param_ExternalId": external_id,
        "param_DbHostAwsAccountId": account_id,
    })
    return f"https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?{params}"


def _validate_byo_role_sync(
    *,
    role_arn: str,
    external_id: str,
    bucket_name: str,
    bucket_region: str,
) -> None:
    """Assume the role and verify s3:ListBucket — raises RuntimeError on failure."""
    creds = assume_byo_role(
        role_arn=role_arn,
        external_id=external_id,
        region=bucket_region,
        endpoint_url=_AWS_ENDPOINT_URL,
    )
    s3 = boto3.client(
        "s3",
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=bucket_region,
        endpoint_url=_AWS_ENDPOINT_URL or None,
    )
    try:
        s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        raise RuntimeError(f"s3:ListBucket on '{bucket_name}' failed ({code}): {e}") from e


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/setup", response_model=BYOBucketSetupResponse)
async def byo_setup(user: CurrentUser) -> BYOBucketSetupResponse:
    """
    Return the ExternalId and CloudFormation launch URL for this user.
    Idempotent — safe to call multiple times; ExternalId never changes once set.
    """
    user_id = user["sub"]
    config = await storage.get_byo_config(user_id)

    if config is None:
        config = BYOBucketConfig(
            user_id=user_id,
            external_id=str(uuid.uuid4()),
        )
        await storage.upsert_byo_config(config)

    account_id = await run_in_threadpool(_get_account_id)
    cf_url = _build_cf_launch_url(external_id=config.external_id, account_id=account_id)

    return BYOBucketSetupResponse(
        external_id=config.external_id,
        platform_aws_account_id=account_id,
        cf_launch_url=cf_url,
        already_connected=config.validated_at is not None,
    )


@router.post("/connect", response_model=BYOBucketConnectResponse)
async def byo_connect(body: BYOBucketConnectRequest, user: CurrentUser) -> BYOBucketConnectResponse:
    """
    Validate the user's cross-account role + bucket, then persist the config.
    Call GET /byo-bucket/setup first to get the ExternalId for your IAM trust policy.
    """
    user_id = user["sub"]
    config = await storage.get_byo_config(user_id)
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Call GET /byo-bucket/setup first to obtain your ExternalId.",
        )

    try:
        await run_in_threadpool(
            _validate_byo_role_sync,
            role_arn=body.role_arn,
            external_id=config.external_id,
            bucket_name=body.bucket_name,
            bucket_region=body.bucket_region,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    config = config.model_copy(update={
        "role_arn": body.role_arn,
        "bucket_name": body.bucket_name,
        "bucket_region": body.bucket_region,
        "validated_at": datetime.now(timezone.utc).isoformat(),
    })
    await storage.upsert_byo_config(config)

    return BYOBucketConnectResponse(
        external_id=config.external_id,
        role_arn=config.role_arn,
        bucket_name=config.bucket_name,
        bucket_region=config.bucket_region,
        validated_at=config.validated_at,
    )


@router.get("/config", response_model=BYOBucketConnectResponse)
async def byo_get_config(user: CurrentUser) -> BYOBucketConnectResponse:
    """Return the current validated BYO bucket config."""
    config = await storage.get_byo_config(user["sub"])
    if not config or not config.validated_at:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No validated BYO bucket config. Call /byo-bucket/connect first.",
        )
    return BYOBucketConnectResponse(
        external_id=config.external_id,
        role_arn=config.role_arn,
        bucket_name=config.bucket_name,
        bucket_region=config.bucket_region,
        validated_at=config.validated_at,
    )


@router.delete("/config", status_code=status.HTTP_204_NO_CONTENT)
async def byo_delete_config(user: CurrentUser) -> None:
    """
    Remove the BYO bucket config. Existing databases retain their stored
    byo_role_arn and continue to work until deleted.
    """
    await storage.delete_byo_config(user["sub"])
