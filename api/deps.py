"""FastAPI dependencies — JWT auth guard."""

import os
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"

_bearer = HTTPBearer()


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    return decode_token(credentials.credentials)


CurrentUser = Annotated[dict, Depends(get_current_user)]


def _admin_email_set() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "")
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def require_admin(user: CurrentUser) -> dict:
    allowed = _admin_email_set()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access not configured",
        )
    email = (user.get("email") or "").strip().lower()
    if email not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


AdminUser = Annotated[dict, Depends(require_admin)]
