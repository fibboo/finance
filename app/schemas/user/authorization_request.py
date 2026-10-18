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
    link_user_id: UUID | None = None


class AuthorizationRequestUpdate(BaseModel):
    user_id: UUID | None
    link_identity: dict | None
    code_hash: str
    expires_at: datetime


class AuthorizationUrlResponse(BaseModel):
    authorization_url: str


class LinkCompleteRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str
