from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, constr, conint, condecimal, root_validator

from app.schemas.base import EnumLowerBase
from app.schemas.expense.expense_category import ExpenseCategory
from app.schemas.expense.expense_place import ExpensePlace


class ExpenseBase(BaseModel):
    datetime: datetime
    amount: condecimal(gt=Decimal('0'))
    comment: Optional[constr(min_length=3, max_length=256)]

    class Config:
        orm_mode = True


class ExpenseCreate(ExpenseBase):
    category_id: UUID
    place_id: UUID


class ExpenseUpdate(ExpenseBase):
    id: UUID
    category_id: UUID
    place_id: UUID


class Expense(ExpenseBase):
    id: UUID
    user_id: UUID
    category: ExpenseCategory
    place: ExpensePlace


class OrderFieldType(EnumLowerBase):
    datetime = 'datetime'
    amount = 'amount'


class OrderDirectionType(EnumLowerBase):
    asc = 'asc'
    desc = 'desc'


class ExpenseRequest(BaseModel):
    skip: conint(ge=0) = 0
    size: conint(ge=1, le=100) = 100
    order_field: OrderFieldType = OrderFieldType.datetime
    order_direction: OrderDirectionType = OrderDirectionType.desc

    date_from: datetime = datetime.now(timezone.utc) - timedelta(days=90)
    date_to: datetime = datetime.now(timezone.utc)
    category_ids: list[UUID] = []
    place_ids: list[UUID] = []
    amount_from: condecimal(ge=Decimal('0')) = Decimal('0')
    amount_to: condecimal(gt=Decimal('0')) = Decimal('999999999')

    @root_validator
    def prepare_dates(cls, values: dict) -> dict:
        values['date_from'] = values['date_from'].replace(hour=0, minute=0, second=0, microsecond=0,
                                                          tzinfo=timezone.utc)
        values['date_to'] = values['date_to'].replace(hour=23, minute=59, second=59, microsecond=999999,
                                                      tzinfo=timezone.utc)
        return values
