from datetime import date, datetime, UTC
from decimal import Decimal
from enum import Enum
from typing import Annotated, Any, TypeAlias
from uuid import UUID

from fastapi import Query
from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, WithJsonSchema

from app.schemas.accounting.account import AdjustmentCreate
from app.schemas.accounting.location import Location
from app.schemas.accounting.posting import Posting
from app.schemas.base import CurrencyCode, EntityStatusType, RequestAmount, TransactionComment
from app.utils import utils

PositiveAmount: TypeAlias = Annotated[Decimal, Field(gt=Decimal("0"), decimal_places=2)]


class TransactionType(str, Enum):
    EXPENSE = "EXPENSE"
    INCOME = "INCOME"
    TRANSFER = "TRANSFER"
    ADJUSTMENT = "ADJUSTMENT"


TRANSACTION_TYPE_LABELS: frozendict[TransactionType, str] = frozendict(
    {
        TransactionType.EXPENSE: "Expense",
        TransactionType.INCOME: "Income",
        TransactionType.TRANSFER: "Transfer",
        TransactionType.ADJUSTMENT: "Balance adjustment",
    }
)


class MovementRequest(BaseModel):
    transaction_date: date
    comment: TransactionComment | None = None
    from_account_id: UUID
    to_account_id: UUID
    source_amount: RequestAmount
    source_currency: CurrencyCode
    destination_amount: RequestAmount | None = None
    destination_currency: CurrencyCode
    base_currency_amount: RequestAmount | None = None
    location_id: UUID | None = None
    income_period: date | None = None

    @field_validator("income_period", mode="after")
    def validate_income_period(cls, income_period: date | None):
        if income_period is not None and income_period.day != 1:
            income_period = income_period.replace(day=1)

        return income_period

    @model_validator(mode="after")
    def validate_accounts(self) -> MovementRequest:
        if self.from_account_id == self.to_account_id:
            raise ValueError("from_account_id and to_account_id should be different")

        return self


TransactionCreateRequest = MovementRequest | AdjustmentCreate


class TransactionCreate(BaseModel):
    user_id: UUID
    transaction_type: TransactionType
    transaction_date: date
    comment: str | None = None
    base_currency_amount: PositiveAmount | None
    location_id: UUID | None = None
    income_period: date | None = None


class Transaction(BaseModel):
    id: UUID  # noqa: A003
    user_id: UUID
    transaction_type: TransactionType
    transaction_date: date
    comment: str | None
    base_currency_amount: PositiveAmount | None
    location: Location | None
    income_period: date | None
    status: EntityStatusType
    postings: list[Posting]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderFieldType(str, Enum):
    CREATED_AT = "created_at"
    TRANSACTION_DATE = "transaction_date"
    AMOUNT = "base_currency_amount"


class OrderDirectionType(str, Enum):
    ASC = "asc"
    DESC = "desc"


ORDER_QUERY_SEPARATOR: str = ":"


def get_order_query_value(*, field: OrderFieldType, direction: OrderDirectionType) -> str:
    order_query_value: str = f"{field.value}{ORDER_QUERY_SEPARATOR}{direction.value}"
    return order_query_value


TRANSACTION_ORDER_LABELS: frozendict[str, str] = frozendict(
    {
        get_order_query_value(field=OrderFieldType.TRANSACTION_DATE, direction=OrderDirectionType.DESC): "Newest first",
        get_order_query_value(field=OrderFieldType.TRANSACTION_DATE, direction=OrderDirectionType.ASC): "Oldest first",
        get_order_query_value(field=OrderFieldType.AMOUNT, direction=OrderDirectionType.DESC): "Largest first",
        get_order_query_value(field=OrderFieldType.AMOUNT, direction=OrderDirectionType.ASC): "Smallest first",
    }
)


class Order(BaseModel):
    field: OrderFieldType
    ordering: OrderDirectionType | None = None

    @model_validator(mode="before")
    @classmethod
    def parse_query_value(cls, value: Any) -> Any:
        if isinstance(value, str):
            field, _, ordering = value.partition(ORDER_QUERY_SEPARATOR)
            return {"field": field, "ordering": ordering or None}

        return value


ORDER_QUERY_PATTERN: str = (
    f"^({'|'.join(field.value for field in OrderFieldType)})"
    f"({ORDER_QUERY_SEPARATOR}({'|'.join(direction.value for direction in OrderDirectionType)}))?$"
)
OrderQueryValue: TypeAlias = Annotated[Order, WithJsonSchema({"type": "string", "pattern": ORDER_QUERY_PATTERN})]


class TransactionRequest(Params):
    page: int = Query(1, ge=1, description="Page number")
    size: int = Query(20, ge=1, le=100, description="Page size")
    orders: Annotated[list[OrderQueryValue], Field(validate_default=True)] = [
        get_order_query_value(field=OrderFieldType.TRANSACTION_DATE, direction=OrderDirectionType.DESC)
    ]

    base_currency_amount_from: Annotated[Decimal, Field(ge=Decimal("0"), decimal_places=2)] | None = None
    base_currency_amount_to: PositiveAmount | None = None

    date_from: date | None = None
    date_to: date | None = None

    transaction_types: list[TransactionType] = []
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]

    account_ids: Annotated[list[UUID], Field(max_length=100)] = []
    is_deleted_accounts_only: bool = False

    @model_validator(mode="after")
    def fill_default_date_to(self) -> TransactionRequest:
        if self.date_to is None:
            self.date_to = datetime.now(UTC).date()

        if self.date_from is not None and self.date_from > self.date_to:
            raise ValueError("date_from should not be later than date_to")

        return self

    def __hash__(self):
        data = self.model_dump()
        hashable_items: tuple = utils.make_hashable(value=data)
        return hash(hashable_items)
