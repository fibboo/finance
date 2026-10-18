from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: str


class RefreshTokenCreate(BaseModel):
    user_id: UUID
    token_hash: str
    family_id: UUID
    expires_at: datetime
