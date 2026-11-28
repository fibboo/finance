import csv
import re
from dataclasses import dataclass
from datetime import date, datetime, UTC
from decimal import Decimal
from hashlib import sha256
from io import StringIO
from pathlib import PureWindowsPath
from typing import Any, TypeAlias
from uuid import UUID

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.classification import classification_crud
from app.crud.accounting.currency import currency_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction_import import (
    ImportTransactionKey,
    transaction_import_crud,
    transaction_import_row_crud,
)
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import ImportInProgress
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import ImportDecisionsInvalid, ImportFileInvalid
from app.models.accounting.transaction_import import (
    TransactionImport as ImportModel,
    TransactionImportRow as ImportRowModel,
)
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.transaction import TRANSACTION_TYPE_LABELS, TransactionType
from app.schemas.accounting.transaction_import import (
    IMPORT_COLUMN_HEADERS,
    ImportColumn,
    ImportDecisionsRequest,
    ImportDuplicateDecision,
    ImportEntityGroup,
    ImportFileFormat,
    ImportMatchIssue,
    ImportRowError,
    ImportRowErrorCode,
    TransactionImport,
    TransactionImportRow,
    TransactionImportRowsRequest,
    TransactionImportStatus,
)
from app.schemas.base import CurrencyCode
from app.services.accounting import transaction_import_matching, transaction_import_reader
from app.services.accounting.transaction_import_matching import EntityIdentity, EntityMatches
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
    (ImportColumn.TYPE, ImportColumn.DATE, ImportColumn.AMOUNT, ImportColumn.CURRENCY)
)
_REQUIRED_BY_TYPE: frozendict[TransactionType, frozenset[ImportColumn]] = frozendict(
    {
        TransactionType.EXPENSE: frozenset((ImportColumn.TO,)),
        TransactionType.INCOME: frozenset((ImportColumn.FROM, ImportColumn.TO_CURRENCY, ImportColumn.INCOME_MONTH)),
        TransactionType.TRANSFER: frozenset((ImportColumn.TO_CURRENCY,)),
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
    review: _ImportReview = await _review_import(db=db, import_db=import_db, rows=rows)
    records: list[dict[str, Any]] = []
    for row in rows:
        record: dict[str, Any] = row.model_dump(exclude={"errors"})
        record["errors"] = [error.model_dump(mode="json") for error in row.errors]
        record["import_id"] = import_db.id
        records.append(record)

    await transaction_import_row_crud.insert_rows(db=db, rows=records)
    result: TransactionImport = await _serialize_import(db=db, import_db=import_db, review=review)
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
    import_db: ImportModel = await _get_owned_import(db=db, user_id=user_id, import_id=import_id)
    review: _ImportReview = await _review_import(db=db, import_db=import_db)
    rows: list[TransactionImportRow] = [
        row
        for row in review.rows
        if (request.has_errors is None or (len(row.errors) > 0) == request.has_errors)
        and (request.is_duplicate is None or _is_duplicate(row=row) == request.is_duplicate)
    ]
    page_rows: list[TransactionImportRow] = rows[request.to_raw_params().as_slice()]
    result: Page[TransactionImportRow] = Page[TransactionImportRow].create(page_rows, params=request, total=len(rows))
    return result


async def save_decisions(
    *, db: AsyncSession, user_id: UUID, import_id: UUID, request: ImportDecisionsRequest
) -> TransactionImport:
    import_db: ImportModel = await _get_owned_import(db=db, user_id=user_id, import_id=import_id, with_for_update=True)
    if import_db.status != TransactionImportStatus.REVIEW:
        raise ImportInProgress(logger=logger)

    stored_rows: list[ImportRowModel] = await transaction_import_row_crud.get_rows(db=db, import_id=import_id)
    rows: list[TransactionImportRow] = [TransactionImportRow.model_validate(row) for row in stored_rows]
    review: _ImportReview = await _review_import(db=db, import_db=import_db, rows=rows, request=request)
    saved = ImportDecisionsRequest(
        entities=request.entities,
        duplicates=[
            ImportDuplicateDecision(row_number=row.row_number, is_kept=row.is_kept)
            for row in review.rows
            if row.is_kept is not None
        ],
    )
    updated_import: ImportModel = await transaction_import_crud.update_api(
        db=db, db_obj=import_db, obj_in={"decisions": saved.model_dump(mode="json"), "preview": None}
    )
    reviews: list[dict[str, Any]] = []
    for stored, row in zip(stored_rows, review.rows, strict=True):
        errors: list[dict] = [error.model_dump(mode="json") for error in row.errors]
        if (stored.errors, stored.duplicate_transaction_id, stored.duplicate_row_number, stored.is_kept) != (
            errors,
            row.duplicate_transaction_id,
            row.duplicate_row_number,
            row.is_kept,
        ):
            reviews.append(
                {
                    "id": stored.id,
                    "errors": errors,
                    "duplicate_transaction_id": row.duplicate_transaction_id,
                    "duplicate_row_number": row.duplicate_row_number,
                    "is_kept": row.is_kept,
                }
            )

    await transaction_import_row_crud.update_reviews(db=db, reviews=reviews)
    result: TransactionImport = await _serialize_import(db=db, import_db=updated_import, review=review)
    return result


async def get_report(*, db: AsyncSession, user_id: UUID, import_id: UUID) -> str:
    import_db: ImportModel = await _get_owned_import(db=db, user_id=user_id, import_id=import_id)
    review: _ImportReview = await _review_import(db=db, import_db=import_db)
    with StringIO(newline="") as report:
        writer = csv.writer(report)
        writer.writerow(("Row", "Column", "Problem", "Correction"))
        for row in review.rows:
            for error in row.errors:
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


async def _serialize_import(
    *, db: AsyncSession, import_db: ImportModel, review: _ImportReview | None = None
) -> TransactionImport:
    if review is None:
        review = await _review_import(db=db, import_db=import_db)

    error_row_count: int = sum(len(row.errors) > 0 for row in review.rows)
    duplicates: list[TransactionImportRow] = [row for row in review.rows if _is_duplicate(row=row)]
    undecided_duplicate_count: int = sum(row.is_kept is None for row in duplicates)
    is_ready_for_preview: bool = (
        import_db.status == TransactionImportStatus.REVIEW
        and error_row_count == 0
        and undecided_duplicate_count == 0
        and all(group.issue is None for group in review.entities)
    )
    applied_at: datetime | None = await transaction_import_crud.get_last_applied_at(
        db=db, user_id=import_db.user_id, file_hash=import_db.file_hash
    )
    result = TransactionImport(
        id=import_db.id,
        status=import_db.status,
        file_name=import_db.file_name,
        file_format=import_db.file_format,
        row_count=len(review.rows),
        entities=review.entities,
        duplicate_row_count=len(duplicates),
        undecided_duplicate_count=undecided_duplicate_count,
        is_ready_for_preview=is_ready_for_preview,
        error_row_count=error_row_count,
        ignored_columns=import_db.ignored_columns,
        already_imported_on=applied_at.astimezone(UTC).date() if applied_at is not None else None,
        failure=import_db.failure,
        created_at=import_db.created_at,
        updated_at=import_db.updated_at,
    )
    return result


@dataclass(frozen=True)
class _ImportReview:
    rows: list[TransactionImportRow]
    entities: list[ImportEntityGroup]


DuplicateKey: TypeAlias = tuple[TransactionType, date, EntityIdentity, EntityIdentity | None, Decimal]


async def _review_import(
    *,
    db: AsyncSession,
    import_db: ImportModel,
    rows: list[TransactionImportRow] | None = None,
    request: ImportDecisionsRequest | None = None,
) -> _ImportReview:
    if rows is None:
        stored: list[ImportRowModel] = await transaction_import_row_crud.get_rows(db=db, import_id=import_db.id)
        rows = [TransactionImportRow.model_validate(row) for row in stored]

    decisions: ImportDecisionsRequest = request or ImportDecisionsRequest.model_validate(
        import_db.decisions or {"entities": [], "duplicates": []}
    )
    for row in rows:
        row.errors = _file_errors(row=row)

    accounts = await account_crud.get_user_accounts(db=db, user_id=import_db.user_id)
    locations = await location_crud.get_user_locations(db=db, user_id=import_db.user_id)
    classifications = await classification_crud.get_user_classifications(db=db, user_id=import_db.user_id)
    matches: EntityMatches = transaction_import_matching.match_entities(
        rows=rows,
        accounts=accounts,
        locations=locations,
        classifications=classifications,
        decisions=decisions.entities,
        validate_decisions=request is not None,
    )
    row_keys: dict[int, DuplicateKey] = {}
    transaction_keys: set[ImportTransactionKey] = set()
    for row in rows:
        key: DuplicateKey | None = _get_duplicate_key(row=row, matches=matches)
        if key is not None:
            row_keys[row.row_number] = key
            kind, day, from_id, to_id, amount = key
            if isinstance(from_id, UUID) and (to_id is None or isinstance(to_id, UUID)):
                transaction_keys.add(ImportTransactionKey(kind, day, from_id, to_id, amount))

    ledger_matches: dict[ImportTransactionKey, UUID] = await transaction_import_row_crud.find_duplicate_transactions(
        db=db,
        user_id=import_db.user_id,
        keys=transaction_keys,
        equity_ids=[account.id for account in accounts if account.kind == AccountKind.EQUITY],
    )
    duplicate_decisions: dict[int, bool] = {decision.row_number: decision.is_kept for decision in decisions.duplicates}
    if request is not None and len(duplicate_decisions) != len(decisions.duplicates):
        raise ImportDecisionsInvalid(reason="A duplicate row can only be decided once", logger=logger)

    first_rows: dict[DuplicateKey, int] = {}
    decision_rows: set[int] = set()
    for row in rows:
        old_reference: tuple[UUID | None, int | None] = (row.duplicate_transaction_id, row.duplicate_row_number)
        key = row_keys.get(row.row_number)
        row.duplicate_transaction_id = None
        row.duplicate_row_number = None
        row.is_kept = None
        if key is not None:
            row.duplicate_transaction_id = ledger_matches.get(key)
            if row.duplicate_transaction_id is None:
                first: int = first_rows.setdefault(key, row.row_number)
                row.duplicate_row_number = first if first != row.row_number else None

        if _is_duplicate(row=row):
            decision_rows.add(row.row_number)
            reference: tuple[UUID | None, int | None] = (row.duplicate_transaction_id, row.duplicate_row_number)
            if request is not None or reference == old_reference:
                row.is_kept = duplicate_decisions.get(row.row_number)

        if old_reference != (None, None):
            decision_rows.add(row.row_number)

    if request is not None and not duplicate_decisions.keys() <= decision_rows:
        raise ImportDecisionsInvalid(reason="Duplicate decision refers to a row without a duplicate", logger=logger)

    result = _ImportReview(rows=rows, entities=matches.groups)
    return result


def _file_errors(*, row: TransactionImportRow) -> list[ImportRowError]:
    errors: list[ImportRowError] = []
    required: frozenset[ImportColumn] = _REQUIRED_COLUMNS | _REQUIRED_BY_TYPE.get(row.transaction_type, frozenset())
    for error in row.errors:
        if isinstance(error.code, ImportMatchIssue) or error.code == ImportRowErrorCode.SAME_ACCOUNT:
            continue

        if error.code == ImportRowErrorCode.FIELD_REQUIRED and error.column not in required:
            continue

        errors.append(error)

    return errors


def _get_duplicate_key(*, row: TransactionImportRow, matches: EntityMatches) -> DuplicateKey | None:
    from_id: EntityIdentity | None = matches.assignments.get((row.row_number, ImportColumn.FROM))
    to_id: EntityIdentity | None = matches.assignments.get((row.row_number, ImportColumn.TO))
    if row.transaction_type == TransactionType.TRANSFER and from_id is not None and from_id == to_id:
        row.errors.append(
            ImportRowError(
                column=ImportColumn.TO,
                code=ImportRowErrorCode.SAME_ACCOUNT,
                message="A transfer needs two different accounts",
                correction=None,
            )
        )
        return None

    if (
        from_id is None
        or row.transaction_type is None
        or row.transaction_date is None
        or row.amount is None
        or (row.transaction_type != TransactionType.ADJUSTMENT and to_id is None)
    ):
        return None

    result: DuplicateKey = (row.transaction_type, row.transaction_date, from_id, to_id, row.amount)
    return result


def _is_duplicate(*, row: TransactionImportRow) -> bool:
    result: bool = row.duplicate_transaction_id is not None or row.duplicate_row_number is not None
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
