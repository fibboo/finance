import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, constr, conint, condecimal

from app.schemas.expense.expense_category import ExpenseCategory
from app.schemas.expense.expense_place import ExpensePlace


class ExpenseBase(BaseModel):
    date: datetime.date
    amount: condecimal(gt=Decimal('0'))
    comment: Optional[constr(min_length=3, max_length=256)] = None

    class Config:
        orm_mode = True


class ExpenseCreate(ExpenseBase):
    category_id: conint(ge=1)
    place_id: conint(ge=1)


class ExpenseUpdate(BaseModel):
    date: Optional[datetime.date]
    amount: Optional[Decimal]
    comment: Optional[constr(min_length=3, max_length=256)]
    category_id: Optional[conint(ge=1)]
    place_id: Optional[conint(ge=1)]


class Expense(ExpenseBase):
    id: int
    category: ExpenseCategory
    place: ExpensePlace


class ExpenseRequest(BaseModel):
    date_from: Optional[datetime.date] = datetime.date.today() - datetime.timedelta(days=90)
    date_to: Optional[datetime.date] = datetime.date.today()
    category_ids: list[conint(ge=1)] = []
    place_ids: list[conint(ge=1)] = []
    amount_from: Optional[condecimal(ge=Decimal('0'))] = Decimal('0')
    amount_to: Optional[condecimal(gt=Decimal('0'))]
