from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user.external_user import ProviderType


class AuthorizationRequestCreate(BaseModel):
    provider: ProviderType
    state: str
    nonce: str
    provider_code_verifier: str
    client_redirect_uri: str
    client_state: str
    client_code_challenge: str
    expires_at: datetime


class AuthorizationRequestUpdate(BaseModel):
    user_id: UUID
    code_hash: str
    expires_at: datetime
