from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, ConfigDict

from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import User


class SessionAuth(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: str | None = None
    scope: str
    user_identifier: str | None = None
    email: EmailStr | None = None


class AuthUser(BaseModel):
    provider: ProviderType
    external_id: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    avatar: str | None = None
    profile_url: str | None = None
    email: str | None = None


class UserSessionBase(BaseModel):
    user_id: UUID
    expires_at: datetime
    provider: ProviderType

    access_token: str | None = None
    token_type: str | None = None
    expires_in: int | None = None
    refresh_token: str | None = None
    scope: str | None = None


class UserSessionCreate(UserSessionBase):
    pass


class UserSessionUpdate(UserSessionBase):
    pass


class Session(UserSessionBase):
    id: UUID  # noqa: A003
    user: User

    model_config = ConfigDict(from_attributes=True)
