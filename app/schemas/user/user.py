from typing import Optional
from uuid import UUID

from pydantic import ConfigDict, constr

from app.schemas.base import BaseServiceModel, CurrencyType
from app.schemas.user.external_user import ExternalUser, ProviderType


class UserBase(BaseServiceModel):
    username: constr(min_length=3, max_length=64)
    avatar: Optional[constr(min_length=3, max_length=2560)] = None
    registration_provider: ProviderType
    base_currency: Optional[CurrencyType] = CurrencyType.USD


class UserCreate(UserBase):
    pass


class UserUpdate(UserBase):
    pass


class User(UserBase):
    id: UUID
    external_users: list[ExternalUser]

    model_config = ConfigDict(from_attributes=True)
