from datetime import datetime
from enum import Enum
from typing import Annotated, Literal, TypeAlias
from uuid import UUID

from pydantic import BaseModel, StringConstraints

from app.schemas.base import CurrencyCode
from app.schemas.user.external_user import ProviderType

OAuthState: TypeAlias = Annotated[str, StringConstraints(min_length=1, max_length=512)]


class AuthorizeRequest(BaseModel):
    redirect_uri: str
    code_challenge: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{43}$")]
    code_challenge_method: Literal["S256"]
    state: OAuthState


class CallbackRequest(BaseModel):
    state: OAuthState
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


class LinkStatusType(str, Enum):
    LINKED = "linked"
    MERGE_REQUIRED = "merge_required"


class MergeOffer(BaseModel):
    merge_code: str
    username: str
    base_currency: CurrencyCode | None
    accounts_count: int
    transactions_count: int
    is_base_currency_mismatch: bool


class LinkResult(BaseModel):
    status: LinkStatusType
    merge_offer: MergeOffer | None
