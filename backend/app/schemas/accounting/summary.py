from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.base import CurrencyCode


class CurrencyAmount(BaseModel):
    currency: CurrencyCode
    amount: Decimal


class CurrencyRate(BaseModel):
    currency: CurrencyCode
    rate: Decimal


class Summary(BaseModel):
    month: date
    total_balance: Decimal
    estimated_total_balance: Decimal | None
    earned: Decimal
    spent: Decimal
    income_costs: Decimal | None = None
    net_income: Decimal | None = None
    personal_spending: Decimal | None = None
    left_over: Decimal
    unvalued_spent: list[CurrencyAmount]
    estimated_unvalued_spent: Decimal | None
    estimate_rates: list[CurrencyRate]
