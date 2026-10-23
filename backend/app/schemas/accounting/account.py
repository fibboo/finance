from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Annotated, TypeAlias
from uuid import UUID

from fastapi import Query
from fastapi_pagination import Params
from pydantic import BaseModel, computed_field, ConfigDict, Field, model_validator, StringConstraints

from app.schemas.base import CurrencyCode, EntityStatusType, RequestAmount, TransactionComment
from app.utils import utils


class AccountKind(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


ACCOUNT_KIND_LABELS: frozendict[AccountKind, str] = frozendict(
    {
        AccountKind.ASSET: "Asset",
        AccountKind.LIABILITY: "Liability",
        AccountKind.EQUITY: "Equity",
        AccountKind.INCOME: "Income",
        AccountKind.EXPENSE: "Expense",
    }
)

MONEY_ACCOUNT_KINDS: list[AccountKind] = [AccountKind.ASSET, AccountKind.LIABILITY]
VISIBLE_ACCOUNT_KINDS: list[AccountKind] = [kind for kind in AccountKind if kind != AccountKind.EQUITY]

AccountColor: TypeAlias = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]


class CategoryType(str, Enum):
    VARIABLE = "VARIABLE"
    FIXED = "FIXED"
    PERIODIC = "PERIODIC"


CATEGORY_TYPE_LABELS: frozendict[CategoryType, str] = frozendict(
    {
        CategoryType.VARIABLE: "Variable",
        CategoryType.FIXED: "Fixed",
        CategoryType.PERIODIC: "Periodic",
    }
)


class AccountBase(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=4096)] | None = None


class AccountCreateBase(AccountBase):
    kind: AccountKind
    currency: CurrencyCode | None = None
    color: AccountColor | None = None
    category_type: CategoryType | None = None


class AccountCreateRequest(AccountCreateBase):
    @model_validator(mode="after")
    def validate_kind_fields(self) -> AccountCreateRequest:
        if self.kind == AccountKind.EQUITY:
            raise ValueError(f"{AccountKind.EQUITY.value} accounts can not be created")

        is_money_account: bool = self.kind in MONEY_ACCOUNT_KINDS
        if is_money_account != (self.currency is not None):
            raise ValueError("currency should be filled for ASSET and LIABILITY accounts only")

        is_expense_account: bool = self.kind == AccountKind.EXPENSE
        if is_expense_account != (self.category_type is not None):
            raise ValueError("category_type should be filled for EXPENSE accounts only")

        return self


class AccountCreate(AccountCreateBase):
    user_id: UUID


class AccountUpdate(AccountBase):
    color: AccountColor | None = None
    category_type: CategoryType | None = None

    @model_validator(mode="after")
    def validate_category_type(self) -> AccountUpdate:
        if "category_type" in self.model_fields_set and self.category_type is None:
            raise ValueError("category_type can not be null")

        return self


class Account(AccountBase):
    id: UUID  # noqa: A003
    user_id: UUID
    kind: AccountKind

    balance: Decimal
    currency: CurrencyCode | None
    color: str | None
    category_type: CategoryType | None
    base_balance: Decimal = Field(exclude=True)
    status: EntityStatusType

    @computed_field
    @property
    def base_currency_rate(self) -> Decimal:
        base_currency_rate: Decimal = utils.get_base_currency_rate(balance=self.balance, base_balance=self.base_balance)
        return base_currency_rate

    @computed_field
    @property
    def base_currency_balance(self) -> Decimal:
        base_currency_balance: Decimal = utils.round_to_cents(amount=self.base_balance)
        return base_currency_balance

    model_config = ConfigDict(from_attributes=True)


class AccountRequest(Params):
    page: int = Query(1, ge=1, description="Page number")
    size: int = Query(20, ge=1, le=100, description="Page size")

    search_term: Annotated[str, StringConstraints(min_length=3)] | None = None
    kinds: list[AccountKind] = VISIBLE_ACCOUNT_KINDS
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]

    def __hash__(self):
        data = self.model_dump()
        hashable_items: tuple = utils.make_hashable(value=data)
        return hash(hashable_items)


class AdjustmentRequest(BaseModel):
    transaction_date: date
    comment: TransactionComment | None = None
    new_balance: Annotated[Decimal, Field(max_digits=15, decimal_places=2)]
    base_currency_amount: RequestAmount | None = None


class AdjustmentCreate(AdjustmentRequest):
    account_id: UUID
