from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import CurrencyType, EntityStatusType


class AccountType(str, Enum):
    CHECKING = 'CHECKING'
    RESERVE = 'RESERVE'
    PORTFOLIO = 'PORTFOLIO'

    EXTERNAL = 'EXTERNAL'


class AccountBase(BaseModel):
    base_currency_rate: Decimal


class AccountCreate(AccountBase):
    user_id: UUID
    amount: Decimal = Decimal(0)
    currency: CurrencyType
    account_type: AccountType


class AccountUpdate(AccountBase):
    pass


class Account(AccountBase, AccountCreate):
    id: UUID  # noqa: A003
    status: EntityStatusType
