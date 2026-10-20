from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class Summary(BaseModel):
    month: date
    total_balance: Decimal
    earned: Decimal
    spent: Decimal
    left_over: Decimal
