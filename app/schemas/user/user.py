from uuid import UUID

from pydantic import ConfigDict, constr

from app.schemas.base import BaseServiceModel, CurrencyType
from app.schemas.user.external_user import ExternalUser, ProviderType


class UserBase(BaseServiceModel):
    username: constr(min_length=3, max_length=64)
    avatar: constr(min_length=3, max_length=2560) | None = None
    registration_provider: ProviderType
    base_currency: CurrencyType | None = CurrencyType.USD


class UserCreate(UserBase):
    pass


class UserUpdate(UserBase):
    pass


class User(UserBase):
    id: UUID  # noqa: A003
    external_users: list[ExternalUser]

    model_config = ConfigDict(from_attributes=True)
