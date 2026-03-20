import uuid
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, HTTPException, status

import storage
from deps import create_access_token
from models import AuthResponse, SigninRequest, SignupRequest, UserRecord

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest) -> AuthResponse:
    existing = await storage.get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    record = UserRecord(
        user_id=user_id,
        email=body.email,
        password_hash=_hash_password(body.password),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    await storage.create_user(record)

    token = create_access_token(user_id=user_id, email=body.email)
    return AuthResponse(access_token=token, user_id=user_id, email=body.email)


@router.post("/signin", response_model=AuthResponse)
async def signin(body: SigninRequest) -> AuthResponse:
    user = await storage.get_user_by_email(body.email)
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=user.user_id, email=user.email)
    return AuthResponse(access_token=token, user_id=user.user_id, email=user.email)
