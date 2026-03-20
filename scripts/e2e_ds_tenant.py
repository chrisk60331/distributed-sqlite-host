#!/usr/bin/env python3
"""Tenant distributed_sqlite over STS: signup → create DB → connect() → DDL/INSERT/SELECT."""

from __future__ import annotations

import os
import sys
import time

import httpx
from sqlalchemy import text

from db_host_client.client import connect


def main() -> None:
    base = (
        os.environ.get("BASE_URL") or os.environ.get("DB_HOST_API_URL") or "http://localhost:8000"
    ).rstrip("/")
    stamp = str(int(time.time()))
    email = f"ds-tenant-{stamp}@example.com"
    password = f"pw-{stamp}-long-enough"
    db_name = f"smt{stamp}"

    with httpx.Client(timeout=120.0) as client:
        r = client.post(f"{base}/auth/signup", json={"email": email, "password": password})
        r.raise_for_status()
        token = r.json()["access_token"]

        r = client.post(
            f"{base}/databases",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": db_name},
        )
        r.raise_for_status()
        body = r.json()
        api_key = body.get("api_key")
        if not api_key:
            r = client.post(
                f"{base}/databases/{body['db_id']}/api-key",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            api_key = r.json()["api_key"]

    marker = f"sdk-e2e-{stamp}"
    with connect(api_key=api_key, api_base_url=base) as engine:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS smoke_e2e (id INTEGER PRIMARY KEY, msg TEXT)"
                )
            )
            conn.execute(text("INSERT INTO smoke_e2e (msg) VALUES (:m)"), {"m": marker})
            row = conn.execute(text("SELECT msg FROM smoke_e2e WHERE id = 1")).scalar_one()
    if row != marker:
        print(f"FAIL: expected {marker!r}, got {row!r}", file=sys.stderr)
        sys.exit(1)

    print("PASS: tenant DS (STS + boto3_session) write/read OK")


if __name__ == "__main__":
    main()
