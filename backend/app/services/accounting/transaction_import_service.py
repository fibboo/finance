import csv
import re
from datetime import date, datetime, UTC
from decimal import Decimal
from hashlib import sha256
from io import StringIO
from pathlib import PureWindowsPath
from typing import Any
from uuid import UUID

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.currency import currency_crud
from app.crud.accounting.transaction_import import transaction_import_crud, transaction_import_row_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import ImportInProgress
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import ImportFileInvalid
from app.models.accounting.transaction_import import (
    TransactionImport as ImportModel,
    TransactionImportRow as ImportRowModel,
)
from app.schemas.accounting.transaction import TRANSACTION_TYPE_LABELS, TransactionType
from app.schemas.accounting.transaction_import import (
    IMPORT_COLUMN_HEADERS,
    ImportColumn,
    ImportFileFormat,
    ImportRowError,
    ImportRowErrorCode,
    TransactionImport,
    TransactionImportRow,
    TransactionImportRowsRequest,
    TransactionImportStatus,
)
from app.schemas.base import CurrencyCode
from app.services.accounting import transaction_import_reader
from app.services.accounting.transaction_import_reader import CellValue, ImportFileRows, RawRow

logger = get_logger(logger_name=__name__)

_COLUMN_FIELDS: frozendict[ImportColumn, str] = frozendict(
    {
        ImportColumn.TYPE: "transaction_type",
        ImportColumn.DATE: "transaction_date",
        ImportColumn.FROM: "from_name",
        ImportColumn.TO: "to_name",
        ImportColumn.AMOUNT: "amount",
        ImportColumn.CURRENCY: "currency",
        ImportColumn.TO_AMOUNT: "to_amount",
        ImportColumn.TO_CURRENCY: "to_currency",
        ImportColumn.BASE_AMOUNT: "base_currency_amount",
        ImportColumn.INCOME_MONTH: "income_period",
        ImportColumn.LOCATION: "location_name",
        ImportColumn.COMMENT: "comment",
    }
)
_REQUIRED_COLUMNS: frozenset[ImportColumn] = frozenset(
    (ImportColumn.TYPE, ImportColumn.DATE, ImportColumn.FROM, ImportColumn.AMOUNT, ImportColumn.CURRENCY)
)
_REQUIRED_BY_TYPE: frozendict[TransactionType, frozenset[ImportColumn]] = frozendict(
    {
        TransactionType.EXPENSE: frozenset((ImportColumn.TO,)),
        TransactionType.INCOME: frozenset((ImportColumn.TO, ImportColumn.TO_CURRENCY, ImportColumn.INCOME_MONTH)),
        TransactionType.TRANSFER: frozenset((ImportColumn.TO, ImportColumn.TO_CURRENCY)),
        TransactionType.ADJUSTMENT: frozenset(),
    }
)
_ALLOWED_BY_TYPE: frozendict[ImportColumn, frozenset[TransactionType]] = frozendict(
    {
        ImportColumn.TO: frozenset((TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER)),
        ImportColumn.TO_AMOUNT: frozenset((TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER)),
        ImportColumn.TO_CURRENCY: frozenset(
            (TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER)
        ),
        ImportColumn.BASE_AMOUNT: frozenset((TransactionType.INCOME, TransactionType.ADJUSTMENT)),
        ImportColumn.INCOME_MONTH: frozenset((TransactionType.INCOME,)),
        ImportColumn.LOCATION: frozenset((TransactionType.EXPENSE,)),
    }
)
_TRANSACTION_TYPES: frozendict[str, TransactionType] = frozendict(
    {
        name.casefold(): transaction_type
        for transaction_type, label in TRANSACTION_TYPE_LABELS.items()
        for name in (transaction_type.value, label)
    }
)
_AMOUNT_COLUMNS: frozenset[ImportColumn] = frozenset(
    (ImportColumn.AMOUNT, ImportColumn.TO_AMOUNT, ImportColumn.BASE_AMOUNT)
)
_DATE_TEXT = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
_MONTH_TEXT = re.compile(r"[0-9]{4}-[0-9]{2}")
_DECIMAL_TEXT = re.compile(r"-?[0-9]+(?:\.[0-9]+)?")
_COMMA_DECIMAL_TEXT = re.compile(r"-?[0-9]+,[0-9]{1,2}")


async def upload(*, db: AsyncSession, user_id: UUID, file: UploadFile) -> TransactionImport:
    filename = PureWindowsPath(file.filename or "")
    file_name: str = filename.name
    extension: str = filename.suffix.removeprefix(".").upper()
    if extension not in ImportFileFormat or "\x00" in file_name:
        raise ImportFileInvalid(problems=["Choose an XLSX or CSV file"], logger=logger)

    file_format = ImportFileFormat(extension)
    content: bytes = await file.read(transaction_import_reader.MAX_IMPORT_BYTES + 1)
    file_rows: ImportFileRows = await run_in_threadpool(
        transaction_import_reader.read_rows, file_format=file_format, content=content
    )
    currencies: set[CurrencyCode] = {currency.code for currency in await currency_crud.get_currencies(db=db)}
    rows: list[TransactionImportRow] = [_validate_row(row=row, currencies=currencies) for row in file_rows.rows]

    await user_crud.get_locked_by_ids(db=db, ids=[user_id])
    open_import: ImportModel | None = await transaction_import_crud.get_open(
        db=db, user_id=user_id, with_for_update=True
    )
    if open_import is not None:
        if open_import.status != TransactionImportStatus.REVIEW:
            raise ImportInProgress(logger=logger)

        await transaction_import_crud.update_orm(
            db=db, id=open_import.id, obj_in={"status": TransactionImportStatus.CANCELLED}
        )

    import_db: ImportModel = await transaction_import_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": file_name,
            "file_format": file_format,
            "file_hash": sha256(content).hexdigest(),
            "ignored_columns": file_rows.ignored_columns,
        },
    )
    records: list[dict[str, Any]] = []
    for row in rows:
        record: dict[str, Any] = row.model_dump(exclude={"errors"})
        record["errors"] = [error.model_dump(mode="json") for error in row.errors]
        record["import_id"] = import_db.id
        records.append(record)

    await transaction_import_row_crud.insert_rows(db=db, rows=records)
    result: TransactionImport = await _serialize_import(db=db, import_db=import_db)
    return result


async def get_current(*, db: AsyncSession, user_id: UUID) -> TransactionImport:
    import_db: ImportModel | None = await transaction_import_crud.get_open(db=db, user_id=user_id)
    if import_db is None:
        raise EntityNotFound(entity=ImportModel, search_params={"user_id": user_id, "open": True}, logger=logger)

    result: TransactionImport = await _serialize_import(db=db, import_db=import_db)
    return result


async def get_import(*, db: AsyncSession, user_id: UUID, import_id: UUID) -> TransactionImport:
    import_db: ImportModel = await _get_owned_import(db=db, user_id=user_id, import_id=import_id)
    result: TransactionImport = await _serialize_import(db=db, import_db=import_db)
    return result


async def get_rows(
    *, db: AsyncSession, user_id: UUID, import_id: UUID, request: TransactionImportRowsRequest
) -> Page[TransactionImportRow]:
    await _get_owned_import(db=db, user_id=user_id, import_id=import_id)
    rows: Page[ImportRowModel] = await transaction_import_row_crud.get_page(db=db, import_id=import_id, request=request)
    result = Page[TransactionImportRow].model_validate(rows)
    return result


async def get_report(*, db: AsyncSession, user_id: UUID, import_id: UUID) -> str:
    await _get_owned_import(db=db, user_id=user_id, import_id=import_id)
    rows: list[ImportRowModel] = await transaction_import_row_crud.get_error_rows(db=db, import_id=import_id)
    with StringIO(newline="") as report:
        writer = csv.writer(report)
        writer.writerow(("Row", "Column", "Problem", "Correction"))
        for row in rows:
            for stored_error in row.errors:
                error = ImportRowError.model_validate(stored_error)
                column: str = IMPORT_COLUMN_HEADERS[error.column] if error.column is not None else ""
                writer.writerow((row.row_number, column, error.message, error.correction))

        result: str = report.getvalue()
    return result


async def discard(*, db: AsyncSession, user_id: UUID, import_id: UUID) -> TransactionImport:
    import_db: ImportModel = await _get_owned_import(db=db, user_id=user_id, import_id=import_id, with_for_update=True)
    if import_db.status != TransactionImportStatus.REVIEW:
        raise ImportInProgress(logger=logger)

    updated_import: ImportModel = await transaction_import_crud.update_api(
        db=db, db_obj=import_db, obj_in={"status": TransactionImportStatus.CANCELLED}
    )
    result: TransactionImport = await _serialize_import(db=db, import_db=updated_import)
    return result


async def _get_owned_import(
    *, db: AsyncSession, user_id: UUID, import_id: UUID, with_for_update: bool = False
) -> ImportModel:
    import_db: ImportModel | None = await transaction_import_crud.get_or_none(
        db=db, id=import_id, user_id=user_id, with_for_update=with_for_update
    )
    if import_db is None:
        raise EntityNotFound(entity=ImportModel, search_params={"id": import_id}, logger=logger)

    return import_db


async def _serialize_import(*, db: AsyncSession, import_db: ImportModel) -> TransactionImport:
    row_count, error_row_count = await transaction_import_row_crud.get_counts(db=db, import_id=import_db.id)
    applied_at: datetime | None = await transaction_import_crud.get_last_applied_at(
        db=db, user_id=import_db.user_id, file_hash=import_db.file_hash
    )
    result = TransactionImport(
        id=import_db.id,
        status=import_db.status,
        file_name=import_db.file_name,
        file_format=import_db.file_format,
        row_count=row_count,
        error_row_count=error_row_count,
        ignored_columns=import_db.ignored_columns,
        already_imported_on=applied_at.astimezone(UTC).date() if applied_at is not None else None,
        failure=import_db.failure,
        created_at=import_db.created_at,
        updated_at=import_db.updated_at,
    )
    return result


def _validate_row(*, row: RawRow, currencies: set[CurrencyCode]) -> TransactionImportRow:
    type_cell = row.cells.get(ImportColumn.TYPE)
    transaction_type: TransactionType | None = None
    if type_cell is not None and isinstance(type_cell.value, str) and not type_cell.is_formula:
        transaction_type = _TRANSACTION_TYPES.get(type_cell.value.strip().casefold())

    required: frozenset[ImportColumn] = _REQUIRED_COLUMNS | _REQUIRED_BY_TYPE.get(transaction_type, frozenset())
    values: dict[str, Any] = {}
    errors: list[ImportRowError] = []
    blank_columns: set[ImportColumn] = set()
    for column, field in _COLUMN_FIELDS.items():
        cell = row.cells.get(column)
        value: CellValue = cell.value if cell is not None else None
        text: str = str(value).strip() if value is not None else ""
        header: str = IMPORT_COLUMN_HEADERS[column]
        allowed: frozenset[TransactionType] | None = _ALLOWED_BY_TYPE.get(column)
        error: ImportRowError | None = None
        parsed: Any = None
        if cell is not None and cell.is_formula:
            error = ImportRowError(
                column=column,
                code=ImportRowErrorCode.FORMULA_NOT_ALLOWED,
                message=f"{header} contains a formula",
                correction="Paste values",
            )
        elif text == "":
            blank_columns.add(column)
            if column in required:
                error = ImportRowError(
                    column=column,
                    code=ImportRowErrorCode.FIELD_REQUIRED,
                    message=f"{header} is required",
                    correction=None,
                )
        elif transaction_type is not None and allowed is not None and transaction_type not in allowed:
            error = ImportRowError(
                column=column,
                code=ImportRowErrorCode.FIELD_NOT_ALLOWED,
                message=f"{header} is not allowed for {TRANSACTION_TYPE_LABELS[transaction_type]}",
                correction=None,
            )
        elif column == ImportColumn.TYPE:
            parsed = transaction_type
            if parsed is None:
                error = ImportRowError(
                    column=column, code=ImportRowErrorCode.INVALID_TYPE, message="Type is unknown", correction=None
                )
        elif column in (ImportColumn.DATE, ImportColumn.INCOME_MONTH):
            parsed = _parse_date(value=value, text=text, is_month=column == ImportColumn.INCOME_MONTH)
            if parsed is None:
                error = ImportRowError(
                    column=column,
                    code=ImportRowErrorCode.INVALID_DATE,
                    message=f"{header} is invalid",
                    correction="Use YYYY-MM" if column == ImportColumn.INCOME_MONTH else "Use YYYY-MM-DD",
                )
        elif column in _AMOUNT_COLUMNS:
            amount_text: str = format(Decimal(text), "f") if isinstance(value, float) else text
            is_signed: bool = transaction_type == TransactionType.ADJUSTMENT and column == ImportColumn.AMOUNT
            parsed, error = _parse_amount(column=column, text=amount_text, is_signed=is_signed)
        elif column in (ImportColumn.CURRENCY, ImportColumn.TO_CURRENCY):
            if text.upper() in currencies:
                parsed = text.upper()
            else:
                error = ImportRowError(
                    column=column,
                    code=ImportRowErrorCode.UNKNOWN_CURRENCY,
                    message=f"{header} is unknown",
                    correction=None,
                )
        else:
            parsed = value if isinstance(value, str) else str(value)

        values[field] = parsed
        if error is not None:
            errors.append(error)

    if transaction_type == TransactionType.EXPENSE and ImportColumn.TO_CURRENCY in blank_columns:
        values["to_currency"] = values["currency"]

    if ImportColumn.TO_AMOUNT in blank_columns:
        if transaction_type == TransactionType.EXPENSE or (
            transaction_type == TransactionType.INCOME
            and values["currency"] is not None
            and values["currency"] == values["to_currency"]
        ):
            values["to_amount"] = values["amount"]

    result = TransactionImportRow(row_number=row.row_number, errors=errors, **values)
    return result


def _parse_date(*, value: CellValue, text: str, is_month: bool) -> date | None:
    parsed: date | None = None
    if isinstance(value, datetime):
        parsed = value.date()
    elif isinstance(value, date):
        parsed = value
    else:
        if is_month and _MONTH_TEXT.fullmatch(text) is not None:
            text = f"{text}-01"

        if _DATE_TEXT.fullmatch(text) is not None:
            try:
                parsed = date.fromisoformat(text)
            except ValueError:
                parsed = None

    if parsed is not None and is_month:
        parsed = parsed.replace(day=1)

    return parsed


def _parse_amount(*, column: ImportColumn, text: str, is_signed: bool) -> tuple[Decimal | None, ImportRowError | None]:
    header: str = IMPORT_COLUMN_HEADERS[column]
    amount: Decimal | None = None
    code: ImportRowErrorCode | None = None
    correction: str | None = None
    message: str = f"{header} must be a {'non-zero' if is_signed else 'positive'} decimal amount"
    if _COMMA_DECIMAL_TEXT.fullmatch(text) is not None:
        code = ImportRowErrorCode.INVALID_AMOUNT
        message = f"{header} uses a comma as the decimal separator"
        correction = text.replace(",", ".")
    elif _DECIMAL_TEXT.fullmatch(text) is None or len(text.lstrip("-").split(".", 1)[0].lstrip("0")) > 13:
        code = ImportRowErrorCode.INVALID_AMOUNT
        if "," in text:
            message = f"{header} has an ambiguous comma or grouping separator"
    elif len(text.partition(".")[2]) > 2:
        code = ImportRowErrorCode.AMOUNT_PRECISION
        message = f"{header} has more than two decimal places"
    else:
        parsed = Decimal(text)
        if parsed == 0 or not is_signed and parsed < 0:
            code = ImportRowErrorCode.INVALID_AMOUNT
        else:
            amount = parsed

    error: ImportRowError | None = None
    if code is not None:
        error = ImportRowError(column=column, code=code, message=message, correction=correction)

    result: tuple[Decimal | None, ImportRowError | None] = (amount, error)
    return result
