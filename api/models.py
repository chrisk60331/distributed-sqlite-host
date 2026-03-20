from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Any, Optional
from datetime import datetime


class SignupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class SigninRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class UserRecord(BaseModel):
    user_id: str
    email: str
    password_hash: str
    created_at: str


class CreateDatabaseRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        import re
        v = v.strip().lower()
        if not re.match(r"^[a-z][a-z0-9_-]{0,62}$", v):
            raise ValueError(
                "Name must start with a letter, contain only lowercase letters, digits, hyphens, underscores, and be ≤ 63 chars"
            )
        return v


class DatabaseRecord(BaseModel):
    db_id: str
    user_id: str
    name: str
    bucket: str
    prefix: str
    region: str
    endpoint_url: Optional[str] = None
    created_at: str
    api_key_hash: Optional[str] = None


class DatabaseResponse(BaseModel):
    db_id: str
    name: str
    bucket: str
    prefix: str
    region: str
    created_at: str


class CreateDatabaseResponse(DatabaseResponse):
    """Returned once from create — includes the raw API key for SDK / direct S3 session exchange."""

    api_key: str


class MintApiKeyResponse(BaseModel):
    api_key: str


class DatabaseS3SessionRequest(BaseModel):
    api_key: str


class DatabaseS3SessionResponse(BaseModel):
    access_key_id: str
    secret_access_key: str
    session_token: str
    expiration: datetime
    bucket: str
    prefix: str
    region: str
    endpoint_url: Optional[str] = None


class DatabaseExecuteStepResult(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


class DatabaseExecuteRequest(BaseModel):
    statements: list[str] = Field(min_length=1, max_length=100)

    @field_validator("statements")
    @classmethod
    def statements_valid(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for i, raw in enumerate(v):
            s = raw.strip()
            if not s:
                raise ValueError(f"Statement {i} is empty")
            if len(s) > 100_000:
                raise ValueError(f"Statement {i} exceeds maximum length")
            out.append(s)
        return out


class DatabaseExecuteResponse(BaseModel):
    steps: list[DatabaseExecuteStepResult | None]


class EnvFileResponse(BaseModel):
    content: str
    filename: str


class AdminAccessResponse(BaseModel):
    admin: bool = True


class AdminUserResponse(BaseModel):
    user_id: str
    email: str
    created_at: str


class AdminDatabaseResponse(BaseModel):
    db_id: str
    user_id: str
    owner_email: str
    name: str
    bucket: str
    prefix: str
    region: str
    created_at: str
    connection_url: str


class AdminBootstrapResponse(BaseModel):
    users: list[AdminUserResponse]
    databases: list[AdminDatabaseResponse]


class AdminUserDeleteResult(BaseModel):
    databases_removed: int
