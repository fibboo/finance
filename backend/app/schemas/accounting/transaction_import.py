from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict

from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import CurrencyCode

TRANSACTIONS_SHEET: str = "Transactions"


class ImportFileFormat(StrEnum):
    XLSX = "XLSX"
    CSV = "CSV"


class ImportColumn(StrEnum):
    TYPE = "TYPE"
    DATE = "DATE"
    FROM = "FROM"
    TO = "TO"
    AMOUNT = "AMOUNT"
    CURRENCY = "CURRENCY"
    TO_AMOUNT = "TO_AMOUNT"
    TO_CURRENCY = "TO_CURRENCY"
    BASE_AMOUNT = "BASE_AMOUNT"
    INCOME_MONTH = "INCOME_MONTH"
    LOCATION = "LOCATION"
    COMMENT = "COMMENT"


IMPORT_COLUMN_HEADERS: frozendict[ImportColumn, str] = frozendict(
    {
        ImportColumn.TYPE: "Type",
        ImportColumn.DATE: "Date",
        ImportColumn.FROM: "From",
        ImportColumn.TO: "To",
        ImportColumn.AMOUNT: "Amount",
        ImportColumn.CURRENCY: "Currency",
        ImportColumn.TO_AMOUNT: "To amount",
        ImportColumn.TO_CURRENCY: "To currency",
        ImportColumn.BASE_AMOUNT: "Base amount",
        ImportColumn.INCOME_MONTH: "Income month",
        ImportColumn.LOCATION: "Location",
        ImportColumn.COMMENT: "Comment",
    }
)


class TransactionImportStatus(StrEnum):
    REVIEW = "REVIEW"
    CANCELLED = "CANCELLED"


class ImportRowErrorCode(StrEnum):
    FIELD_REQUIRED = "FIELD_REQUIRED"
    FIELD_NOT_ALLOWED = "FIELD_NOT_ALLOWED"
    INVALID_TYPE = "INVALID_TYPE"
    INVALID_DATE = "INVALID_DATE"
    INVALID_AMOUNT = "INVALID_AMOUNT"
    AMOUNT_PRECISION = "AMOUNT_PRECISION"
    UNKNOWN_CURRENCY = "UNKNOWN_CURRENCY"
    FORMULA_NOT_ALLOWED = "FORMULA_NOT_ALLOWED"


class ImportRowError(BaseModel):
    column: ImportColumn | None
    code: ImportRowErrorCode
    message: str
    correction: str | None


class TransactionImportRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    row_number: int
    transaction_type: TransactionType | None
    transaction_date: date | None
    from_name: str | None
    to_name: str | None
    amount: Decimal | None
    currency: CurrencyCode | None
    to_amount: Decimal | None
    to_currency: CurrencyCode | None
    base_currency_amount: Decimal | None
    income_period: date | None
    location_name: str | None
    comment: str | None
    errors: list[ImportRowError]


class TransactionImportRowsRequest(Params):
    has_errors: bool | None = None


class TransactionImport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: TransactionImportStatus
    file_name: str
    file_format: ImportFileFormat
    row_count: int
    error_row_count: int
    ignored_columns: list[str]
    already_imported_on: date | None
    failure: str | None
    created_at: datetime
    updated_at: datetime
