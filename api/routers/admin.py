import os

import boto3
from fastapi import APIRouter, HTTPException, Response, status

import storage
from deps import AdminUser
from models import (
    AdminAccessResponse,
    AdminBootstrapResponse,
    AdminDatabaseResponse,
    AdminUserDeleteResult,
    AdminUserResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])

S3_BUCKET = os.getenv("S3_BUCKET", "db-host-databases")
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL")


def _s3_client():
    kwargs: dict = dict(region_name=AWS_REGION)
    if AWS_ENDPOINT_URL:
        kwargs["endpoint_url"] = AWS_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def _purge_s3_prefix(bucket: str, prefix: str) -> None:
    prefix = prefix.rstrip("/") + "/"
    s3 = _s3_client()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        contents = page.get("Contents") or []
        if not contents:
            continue
        s3.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": o["Key"]} for o in contents]},
        )


@router.get("/access", response_model=AdminAccessResponse)
async def admin_access(_admin: AdminUser) -> AdminAccessResponse:
    return AdminAccessResponse()


@router.get("/bootstrap", response_model=AdminBootstrapResponse)
async def admin_bootstrap(_admin: AdminUser) -> AdminBootstrapResponse:
    users = await storage.list_all_users()
    user_rows = [
        AdminUserResponse(user_id=u.user_id, email=u.email, created_at=u.created_at)
        for u in users
    ]
    email_by_uid = {u.user_id: u.email for u in users}
    all_dbs = await storage.list_all_databases()
    db_rows: list[AdminDatabaseResponse] = []
    for r in all_dbs:
        owner_email = email_by_uid.get(r.user_id, "(orphaned)")
        conn_url = f"distributed_sqlite+distributed_sqlite:///{r.bucket}/{r.prefix}"
        db_rows.append(
            AdminDatabaseResponse(
                db_id=r.db_id,
                user_id=r.user_id,
                owner_email=owner_email,
                name=r.name,
                bucket=r.bucket,
                prefix=r.prefix,
                region=r.region,
                created_at=r.created_at,
                connection_url=conn_url,
            )
        )
    return AdminBootstrapResponse(users=user_rows, databases=db_rows)


@router.delete("/users/{user_id}", response_model=AdminUserDeleteResult)
async def admin_delete_user(user_id: str, admin: AdminUser) -> AdminUserDeleteResult:
    if user_id == admin["sub"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    existing = await storage.get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    n = await storage.delete_user_memories(user_id)
    _purge_s3_prefix(S3_BUCKET, f"{user_id}/")
    return AdminUserDeleteResult(databases_removed=n)


@router.delete("/databases/{db_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_database(db_id: str, _admin: AdminUser) -> Response:
    rec = await storage.delete_database_by_id_global(db_id)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database not found")
    _purge_s3_prefix(rec.bucket, rec.prefix)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
