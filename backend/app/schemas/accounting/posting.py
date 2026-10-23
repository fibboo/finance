from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import CurrencyCode


class PostingCreate(BaseModel):
    account_id: UUID
    amount: Decimal
    currency: CurrencyCode
    base_amount: Decimal
