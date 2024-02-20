from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import EmailStr, ConfigDict

from app.schemas.base import BaseServiceModel
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import User


class SessionAuth(BaseServiceModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None
    scope: str
    user_identifier: Optional[str] = None
    email: Optional[EmailStr] = None


class AuthUser(BaseServiceModel):
    provider: ProviderType
    external_id: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar: Optional[str] = None
    profile_url: Optional[str] = None
    email: Optional[str] = None


class UserSessionBase(BaseServiceModel):
    user_id: UUID
    expires_at: datetime
    provider: ProviderType

    access_token: Optional[str] = None
    token_type: Optional[str] = None
    expires_in: Optional[int] = None
    refresh_token: Optional[str] = None
    scope: Optional[str] = None


class UserSessionCreate(UserSessionBase):
    pass


class UserSessionUpdate(UserSessionBase):
    pass


class UserSession(UserSessionBase):
    id: UUID
    user: User

    model_config = ConfigDict(from_attributes=True)
