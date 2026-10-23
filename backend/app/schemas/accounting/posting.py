from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.accounting.account import Account
from app.schemas.base import CurrencyCode


class PostingCreate(BaseModel):
    account_id: UUID
    amount: Decimal
    currency: CurrencyCode
    base_amount: Decimal


class Posting(BaseModel):
    id: UUID  # noqa: A003
    account: Account
    amount: Decimal
    currency: CurrencyCode
    base_amount: Decimal

    model_config = ConfigDict(from_attributes=True)
