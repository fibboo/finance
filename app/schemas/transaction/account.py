from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, constr

from app.schemas.base import CurrencyType


class AccountType(str, Enum):
    CHECKING = 'CHECKING'
    RESERVE = 'RESERVE'
    PORTFOLIO = 'PORTFOLIO'
    INCOME = 'INCOME'


class AccountBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: constr(min_length=3, max_length=4096) | None = None
    base_currency_rate: Decimal


class AccountCreateRequest(AccountBase):
    currency: CurrencyType
    account_type: AccountType


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
    account_type: AccountType

    model_config = ConfigDict(from_attributes=True)
