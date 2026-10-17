from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, constr

from app.schemas.user.external_user import ProviderType


class AuthorizeRequest(BaseModel):
    redirect_uri: str
    code_challenge: constr(pattern=r"^[A-Za-z0-9_-]{43}$")
    code_challenge_method: Literal["S256"]
    state: constr(min_length=1, max_length=512)


class CallbackRequest(BaseModel):
    state: str
    code: str | None = None
    error: str | None = None


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
