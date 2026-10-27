from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ExchangeRates(BaseModel):
    result: Literal["success"]
    rates: dict[str, Annotated[Decimal, Field(gt=Decimal("0"))]]
