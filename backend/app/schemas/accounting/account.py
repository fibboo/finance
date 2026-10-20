from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import Query
from fastapi_pagination import Params
from pydantic import BaseModel, computed_field, ConfigDict, StringConstraints

from app.schemas.base import CurrencyCode, EntityStatusType
from app.utils import utils


class AccountBase(BaseModel):
    name: Annotated[str, StringConstraints(min_length=3, max_length=64)]
    description: Annotated[str, StringConstraints(min_length=3, max_length=4096)] | None = None


class AccountCreateRequest(AccountBase):
    currency: CurrencyCode


class AccountCreate(AccountCreateRequest):
    user_id: UUID


class AccountUpdate(AccountBase):
    pass


class Account(AccountBase):
    id: UUID  # noqa: A003
    user_id: UUID

    balance: Decimal
    currency: CurrencyCode
    base_currency_rate: Decimal
    status: EntityStatusType

    @computed_field
    @property
    def base_currency_balance(self) -> Decimal:
        base_currency_balance: Decimal = utils.get_base_currency_balance(
            balance=self.balance, base_currency_rate=self.base_currency_rate
        )
        return base_currency_balance

    model_config = ConfigDict(from_attributes=True)


class AccountRequest(Params):
    page: int = Query(1, ge=1, description="Page number")
    size: int = Query(20, ge=1, le=100, description="Page size")
