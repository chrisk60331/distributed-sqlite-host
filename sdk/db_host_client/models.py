from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
