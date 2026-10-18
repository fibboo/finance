from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import Query
from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.base import CurrencyType, EntityStatusType


class AccountBase(BaseModel):
    name: Annotated[str, StringConstraints(min_length=3, max_length=64)]
    description: Annotated[str, StringConstraints(min_length=3, max_length=4096)] | None = None


class AccountCreateRequest(AccountBase):
    currency: CurrencyType


class AccountCreate(AccountCreateRequest):
    user_id: UUID


class AccountUpdate(AccountBase):
    pass


class Account(AccountBase):
    id: UUID  # noqa: A003
    user_id: UUID

    balance: Decimal
    currency: CurrencyType
    base_currency_rate: Decimal
    status: EntityStatusType

    model_config = ConfigDict(from_attributes=True)


class AccountRequest(Params):
    page: int = Query(1, ge=1, description="Page number")
    size: int = Query(20, ge=1, le=100, description="Page size")
