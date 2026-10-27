from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.base import CurrencyCode


class CurrencyAmount(BaseModel):
    currency: CurrencyCode
    amount: Decimal


class Summary(BaseModel):
    month: date
    total_balance: Decimal
    estimated_total_balance: Decimal | None
    earned: Decimal
    spent: Decimal
    left_over: Decimal
    unvalued_spent: list[CurrencyAmount]
    estimated_unvalued_spent: Decimal | None
