from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, constr, conint, condecimal

from app.schemas.expense.expense_category import ExpenseCategory
from app.schemas.expense.expense_place import ExpensePlace
from schemas.base import EnumLowerBase


class ExpenseBase(BaseModel):
    date: datetime
    amount: condecimal(gt=Decimal('0'))
    comment: Optional[constr(min_length=3, max_length=256)]

    class Config:
        orm_mode = True


class ExpenseCreate(ExpenseBase):
    category_id: UUID
    place_id: UUID


class ExpenseUpdate(ExpenseCreate):
    id: UUID


class Expense(ExpenseBase):
    id: UUID
    category: ExpenseCategory
    place: ExpensePlace


class OrderFieldType(EnumLowerBase):
    date = 'date'
    amount = 'amount'


class OrderDirectionType(EnumLowerBase):
    asc = 'asc'
    desc = 'desc'


class ExpenseRequest(BaseModel):
    skip: conint(ge=0) = 0
    size: conint(ge=1, le=100) = 100
    order_field: OrderFieldType = OrderFieldType.date
    order_direction: OrderDirectionType = OrderDirectionType.asc

    date_from: datetime = datetime.now(timezone.utc) - timedelta(days=90)
    date_to: datetime = datetime.now(timezone.utc)
    category_ids: list[UUID] = []
    place_ids: list[UUID] = []
    amount_from: condecimal(ge=Decimal('0')) = Decimal('0')
    amount_to: condecimal(gt=Decimal('0')) = Decimal('999999999')
