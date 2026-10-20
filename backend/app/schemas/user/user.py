from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.base import CurrencyCode
from app.schemas.user.external_user import ExternalUser, ProviderType

USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 64
AVATAR_MIN_LENGTH = 3
AVATAR_MAX_LENGTH = 2560


class UserBase(BaseModel):
    username: Annotated[str, StringConstraints(min_length=USERNAME_MIN_LENGTH, max_length=USERNAME_MAX_LENGTH)]
    avatar: Annotated[str, StringConstraints(min_length=AVATAR_MIN_LENGTH, max_length=AVATAR_MAX_LENGTH)] | None = None
    registration_provider: ProviderType
    base_currency: CurrencyCode | None = None


class UserCreate(UserBase):
    pass


class UserUpdate(UserBase):
    pass


class BaseCurrencySet(BaseModel):
    base_currency: CurrencyCode


class User(UserBase):
    id: UUID  # noqa: A003
    external_users: list[ExternalUser]

    model_config = ConfigDict(from_attributes=True)
