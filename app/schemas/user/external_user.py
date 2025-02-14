from uuid import UUID

from pydantic import ConfigDict

from app.schemas.base import EnumUpperBase, BaseServiceModel


class ProviderType(EnumUpperBase):
    TELEGRAM = 'TELEGRAM'
    TEST = 'TEST'


class ExternalUserBase(BaseServiceModel):
    user_id: UUID

    provider: ProviderType
    external_id: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    avatar: str | None = None
    profile_url: str | None = None
    email: str | None = None


class ExternalUserCreate(ExternalUserBase):
    pass


class ExternalUserUpdate(ExternalUserBase):
    pass


class ExternalUser(ExternalUserBase):
    id: UUID  # noqa: A003

    model_config = ConfigDict(from_attributes=True)
