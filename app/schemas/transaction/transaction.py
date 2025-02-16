from datetime import datetime, timedelta, date
from decimal import Decimal
from enum import Enum
from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, Field, ConfigDict, condecimal, constr, model_validator

from app.schemas.base import EntityStatusType, CurrencyType
from app.schemas.transaction.category import Category
from app.schemas.transaction.location import Location


class TransactionType(str, Enum):
    INCOME = 'INCOME'
    EXPENSE = 'EXPENSE'
    TRANSFER = 'TRANSFER'


class TransactionBase(BaseModel):
    transaction_date: date
    amount: condecimal(gt=Decimal('0'))
    currency: CurrencyType
    transaction_type: TransactionType

    comment: constr(min_length=3, max_length=256) | None = None

    from_account_id: UUID
    to_account_id: UUID

    category_id: UUID | None = None
    location_id: UUID | None = None

    @model_validator(mode='after')
    def validate_model(self):
        if self.transaction_type == TransactionType.EXPENSE and self.category_id is None and self.location_id is None:
            raise ValueError(f'category_id and location_id should be filled for {self.transaction_type} transactions')
        if self.from_account_id == self.to_account_id:
            raise ValueError('from_account_id and to_account_id should be different')

        return self


class TransactionCreate(TransactionBase):
    user_id: UUID


class TransactionUpdate(TransactionBase):
    pass


class Transaction(TransactionBase):
    id: UUID  # noqa: A003
    user_id: UUID
    status: EntityStatusType
    category: Category
    location: Location

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderFieldType(str, Enum):
    CREATED_AT = 'created_at'
    TRANSACTION_DATE = 'transaction_date'
    AMOUNT = 'amount'


class OrderDirectionType(str, Enum):
    ASC = 'asc'
    DESC = 'desc'


class Order(BaseModel):
    field: OrderFieldType
    ordering: OrderDirectionType | None = None


class TransactionRequest(Params):
    page: int = Field(1, ge=1, description='Page number')
    size: int = Field(20, ge=1, le=100, description='Page size')
    orders: list[Order] = [Order(field=OrderFieldType.TRANSACTION_DATE, ordering=OrderDirectionType.DESC),
                           Order(field=OrderFieldType.CREATED_AT, ordering=OrderDirectionType.DESC)]

    amount_from: condecimal(ge=Decimal('0')) | None = None
    amount_to: condecimal(gt=Decimal('0')) | None = None
    currencies: list[CurrencyType] | None = []

    date_from: datetime | None = datetime.now() - timedelta(days=90)
    date_to: datetime | None = datetime.now()

    category_ids: list[UUID] = []
    location_ids: list[UUID] = []
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]

    def __hash__(self):
        return hash((self.page,
                     self.size,
                     ''.join([f'{order.field}|{order.ordering}' for order in self.orders]),
                     self.amount_from,
                     ''.join(map(str, self.currencies)),
                     self.date_from,
                     self.date_to,
                     ''.join(map(str, self.category_ids)),
                     ''.join(map(str, self.location_ids)),
                     ''.join(map(str, self.statuses))))
