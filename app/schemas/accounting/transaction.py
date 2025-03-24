from datetime import date, datetime, timedelta
from decimal import Decimal
from enum import Enum
from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, condecimal, ConfigDict, constr, Field, field_validator, model_validator

from app.schemas.accounting.account import Account
from app.schemas.accounting.category import Category
from app.schemas.accounting.income_source import IncomeSource
from app.schemas.accounting.location import Location
from app.schemas.base import CurrencyType, EntityStatusType
from app.utils import utils


class TransactionType(str, Enum):
    EXPENSE = 'EXPENSE'
    INCOME = 'INCOME'
    TRANSFER = 'TRANSFER'


class TransactionBase(BaseModel):
    transaction_date: date
    comment: constr(min_length=3, max_length=256) | None = None
    source_amount: condecimal(gt=Decimal('0'), decimal_places=2)
    source_currency: CurrencyType
    destination_amount: condecimal(gt=Decimal('0'), decimal_places=2)
    destination_currency: CurrencyType


class ExpenseRequest(TransactionBase):
    from_account_id: UUID
    category_id: UUID
    location_id: UUID


class IncomeRequest(TransactionBase):
    income_period: date
    income_source_id: UUID
    to_account_id: UUID

    @field_validator('income_period')
    def validate_income_period(cls, income_period: date):
        if income_period.day != 1:
            income_period = income_period.replace(day=1)

        return income_period


class TransferRequest(TransactionBase):
    destination_amount: condecimal(gt=Decimal('0'), decimal_places=2) | None = None
    from_account_id: UUID
    to_account_id: UUID


TransactionCreateRequest = ExpenseRequest | IncomeRequest | TransferRequest


class TransactionCreate(TransactionBase):
    user_id: UUID
    base_currency_amount: condecimal(gt=Decimal('0'), decimal_places=2)

    transaction_type: TransactionType

    category_id: UUID | None = None
    location_id: UUID | None = None

    income_period: date | None = None
    income_source_id: UUID | None = None

    from_account_id: UUID | None = None
    to_account_id: UUID | None = None

    @model_validator(mode='after')
    def validate_model(self):
        if (self.transaction_type == TransactionType.EXPENSE and
                (self.category_id is None or self.location_id is None)):
            raise ValueError(f'category_id and location_id should be filled for {self.transaction_type} transactions')

        if (self.transaction_type == TransactionType.TRANSFER and
                (self.to_account_id is None or self.from_account_id is None)):
            raise ValueError(f'to_account_id and from_account_id should be filled '
                             f'for {self.transaction_type} transactions')

        if self.from_account_id == self.to_account_id:
            raise ValueError('from_account_id and to_account_id should be different')

        return self


class Transaction(TransactionCreate):
    id: UUID  # noqa: A003
    status: EntityStatusType

    income_source: IncomeSource | None = None
    from_account: Account | None = None
    to_account: Account | None = None

    category: Category | None = None
    location: Location | None = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderFieldType(str, Enum):
    CREATED_AT = 'created_at'
    TRANSACTION_DATE = 'transaction_date'
    AMOUNT = 'base_currency_amount'


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

    base_currency_amount_from: condecimal(ge=Decimal('0'), decimal_places=2) | None = None
    base_currency_amount_to: condecimal(gt=Decimal('0'), decimal_places=2) | None = None

    date_from: datetime | None = datetime.now() - timedelta(days=90)
    date_to: datetime | None = datetime.now()

    transaction_types: list[TransactionType] = []
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]

    def __hash__(self):
        data = self.model_dump()
        hashable_items: tuple = utils.make_hashable(data)
        return hash(hashable_items)
