from typing import Optional
from uuid import UUID

from pydantic import ConfigDict

from app.schemas.base import EnumUpperBase, BaseServiceModel


class ProviderType(EnumUpperBase):
    TELEGRAM = 'TELEGRAM'


class ExternalUserBase(BaseServiceModel):
    user_id: UUID

    provider: ProviderType
    external_id: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar: Optional[str] = None
    profile_url: Optional[str] = None
    email: Optional[str] = None


class ExternalUserCreate(ExternalUserBase):
    pass


class ExternalUserUpdate(ExternalUserBase):
    pass


class ExternalUser(ExternalUserBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
