"""Issue tenant-scoped S3 credentials via STS AssumeRole + session policy."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from models import DatabaseRecord, DatabaseS3SessionResponse


def _session_policy_for_prefix(*, bucket: str, prefix: str) -> str:
    prefix = prefix.strip("/")
    p = f"{prefix}/*"
    doc = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "TenantObjectRW",
                "Effect": "Allow",
                "Action": [
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:AbortMultipartUpload",
                    "s3:ListMultipartUploadParts",
                ],
                "Resource": f"arn:aws:s3:::{bucket}/{p}",
            },
            {
                "Sid": "TenantList",
                "Effect": "Allow",
                "Action": ["s3:ListBucket", "s3:ListBucketMultipartUploads"],
                "Resource": f"arn:aws:s3:::{bucket}",
                "Condition": {"StringLike": {"s3:prefix": [p]}},
            },
        ],
    }
    return json.dumps(doc)


def _sts_client(*, region: str, endpoint_url: str | None):
    kwargs: dict = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("sts", **kwargs)


def assume_tenant_s3_session(
    *,
    record: DatabaseRecord,
    role_arn: str,
    duration_seconds: int = 3600,
) -> DatabaseS3SessionResponse:
    """
    Call sts:AssumeRole with an inline session policy limited to this database prefix.
    """
    region = record.region or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
    endpoint = record.endpoint_url or os.getenv("AWS_ENDPOINT_URL") or None
    policy = _session_policy_for_prefix(bucket=record.bucket, prefix=record.prefix)
    session_name = f"dbhost-{record.db_id}".replace("-", "")[:60]
    sts = _sts_client(region=region, endpoint_url=endpoint)
    try:
        resp = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName=session_name,
            Policy=policy,
            DurationSeconds=duration_seconds,
        )
    except ClientError as e:
        raise RuntimeError(f"sts:AssumeRole failed: {e}") from e
    creds = resp["Credentials"]
    exp = creds["Expiration"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return DatabaseS3SessionResponse(
        access_key_id=creds["AccessKeyId"],
        secret_access_key=creds["SecretAccessKey"],
        session_token=creds["SessionToken"],
        expiration=exp,
        bucket=record.bucket,
        prefix=record.prefix,
        region=region,
        endpoint_url=record.endpoint_url,
    )
