from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi_pagination import Params
from pydantic import Field, ConfigDict, condecimal, constr

from app.schemas.base import BaseServiceModel, EnumUpperBase, EntityStatusType, CurrencyType
from app.schemas.expense.category import Category
from app.schemas.expense.location import Location


class ExpenseBase(BaseServiceModel):
    expense_date: date
    original_amount: condecimal(gt=Decimal('0'))
    original_currency: CurrencyType
    comment: Optional[constr(min_length=3, max_length=256)] = None
    category_id: UUID
    location_id: UUID


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    pass


class Expense(ExpenseBase):
    id: UUID
    user_id: UUID
    status: EntityStatusType
    amount: condecimal(gt=Decimal('0'))
    category: Category
    location: Location

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderFieldType(EnumUpperBase):
    CREATED_AT = 'CREATED_AT'
    EXPENSE_DATE = 'EXPENSE_DATE'
    AMOUNT = 'AMOUNT'


class OrderDirectionType(EnumUpperBase):
    ASC = 'ASC'
    DESC = 'DESC'


class Order(BaseServiceModel):
    field: OrderFieldType
    ordering: Optional[OrderDirectionType] = None


class ExpenseRequest(Params):
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(20, ge=1, le=100, description="Page size")
    orders: list[Order] = [Order(field=OrderFieldType.EXPENSE_DATE, ordering=OrderDirectionType.DESC),
                           Order(field=OrderFieldType.CREATED_AT, ordering=OrderDirectionType.DESC)]

    amount_from: Optional[condecimal(ge=Decimal('0'))] = None
    amount_to: Optional[condecimal(gt=Decimal('0'))] = None
    original_amount_from: Optional[Decimal] = None
    original_amount_to: Optional[Decimal] = None
    original_currencies: Optional[list[CurrencyType]] = []

    date_from: Optional[datetime] = datetime.now() - timedelta(days=90)
    date_to: Optional[datetime] = datetime.now()

    category_ids: list[UUID] = []
    location_ids: list[UUID] = []
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]

    def __hash__(self):
        return hash((self.page,
                     self.size,
                     ''.join([f'{order.field}|{order.ordering}' for order in self.orders]),
                     self.amount_from,
                     self.amount_to,
                     self.original_amount_from,
                     self.original_amount_to,
                     ''.join(map(str, self.original_currencies)),
                     self.date_from,
                     self.date_to,
                     ''.join(map(str, self.category_ids)),
                     ''.join(map(str, self.location_ids)),
                     ''.join(map(str, self.statuses))))
