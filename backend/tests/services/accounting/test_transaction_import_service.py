import asyncio
import csv
from datetime import date, datetime, UTC
from decimal import Decimal
from hashlib import sha256
from io import BytesIO, StringIO
from uuid import uuid4

import pytest
from fastapi import UploadFile

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.posting import posting_crud
from app.crud.accounting.transaction import transaction_crud
from app.crud.accounting.transaction_import import transaction_import_crud, transaction_import_row_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import ImportInProgress
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import ImportDecisionsInvalid, ImportFileInvalid
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.transaction import TransactionType
from app.schemas.accounting.transaction_import import (
    IMPORT_COLUMN_HEADERS,
    ImportColumn,
    ImportDecisionsRequest,
    ImportDuplicateDecision,
    ImportEntityAction,
    ImportEntityDecision,
    ImportEntityKind,
    ImportMatchIssue,
    ImportNewEntity,
    ImportRowErrorCode,
    TransactionImportRowsRequest,
    TransactionImportStatus,
)
from app.schemas.base import EntityStatusType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_import_service import (
    discard,
    get_current,
    get_import,
    get_report,
    get_rows,
    save_decisions,
    upload,
)


async def test_upload_validates_rows_and_preserves_entered_names(db, db_transaction, import_user_id):
    # arrange
    content = (
        ",".join(IMPORT_COLUMN_HEADERS.values()) + ",Balance\n"
        "eXpEnSe,2025-03-01, Main card ,Groceries,25.00,EUR,,,,,Market,Lunch,100\n"
        'EXPENSE,2025-03-02,Card,Groceries,"12,50",EUR,1.234,QQQ,,,,,100\n'
        'Expense,2025-02-30,Card,Groceries,"1,234",EUR,,,,,,,100\n'
        "Income,2025-03-03,Employer,Dollars,200,USD,,USD,,2025-02-17,,,100\n"
        "Transfer,2025-03-04,Card,Dollars,5,EUR,,USD,3,,Market,=1+2,100\n"
        "Adjustment,2025-03-05,Card,Cash,-5,EUR,12,USD,3,2025-03,Market,,100\n"
        "Adjustment,2025-03-06,Card,,0,EUR,,,,,,,100\n"
        "Income,2025-03-07,Employer,,20,USD,,,,,,,100\n"
        "Transfer,2025-03-08,Card,Cash,5,EUR,,EUR,,,,,100\n"
    ).encode()
    file = UploadFile(file=BytesIO(content), filename="bank.CSV")

    # act
    result = await upload(db=db_transaction, user_id=import_user_id, file=file)
    await db_transaction.commit()

    # assert
    assert result.status == TransactionImportStatus.REVIEW
    assert result.file_name == "bank.CSV"
    assert result.ignored_columns == ["Balance"]
    assert (result.row_count, result.error_row_count) == (9, 6)
    stored_import = await transaction_import_crud.get(db=db, id=result.id)
    assert stored_import.file_hash == sha256(content).hexdigest()
    page = await get_rows(db=db, user_id=import_user_id, import_id=result.id, request=TransactionImportRowsRequest())
    expense, invalid_expense, ambiguous_expense, income, transfer, adjustment, zero, incomplete, same_currency = (
        page.items
    )
    assert expense.from_name == " Main card "
    assert expense.transaction_type == TransactionType.EXPENSE
    assert expense.amount == expense.to_amount == Decimal("25.00")
    assert expense.currency == expense.to_currency == "EUR"
    assert expense.location_name == "Market"
    assert expense.errors == []
    assert invalid_expense.amount is None
    assert invalid_expense.to_amount is None
    assert invalid_expense.to_currency is None
    assert [(error.column, error.code, error.correction) for error in invalid_expense.errors] == [
        (ImportColumn.AMOUNT, ImportRowErrorCode.INVALID_AMOUNT, "12.50"),
        (ImportColumn.TO_AMOUNT, ImportRowErrorCode.AMOUNT_PRECISION, None),
        (ImportColumn.TO_CURRENCY, ImportRowErrorCode.UNKNOWN_CURRENCY, None),
    ]
    assert ambiguous_expense.transaction_date is None
    assert ambiguous_expense.amount is None
    assert [error.code for error in ambiguous_expense.errors] == [
        ImportRowErrorCode.INVALID_DATE,
        ImportRowErrorCode.INVALID_AMOUNT,
    ]
    assert ambiguous_expense.errors[1].correction is None
    assert income.income_period == date(2025, 2, 1)
    assert income.to_amount == Decimal(200)
    assert [error.code for error in transfer.errors] == [
        ImportRowErrorCode.FIELD_NOT_ALLOWED,
        ImportRowErrorCode.FIELD_NOT_ALLOWED,
        ImportRowErrorCode.FORMULA_NOT_ALLOWED,
    ]
    assert adjustment.amount == Decimal(-5)
    assert adjustment.base_currency_amount == Decimal(3)
    assert [error.column for error in adjustment.errors] == [
        ImportColumn.TO,
        ImportColumn.TO_AMOUNT,
        ImportColumn.TO_CURRENCY,
        ImportColumn.INCOME_MONTH,
        ImportColumn.LOCATION,
    ]
    assert zero.amount is None
    assert [error.code for error in zero.errors] == [ImportRowErrorCode.INVALID_AMOUNT]
    assert [error.column for error in incomplete.errors] == [
        ImportColumn.TO_CURRENCY,
        ImportColumn.INCOME_MONTH,
    ]
    assert same_currency.to_amount is None
    assert same_currency.errors == []


async def test_rows_filter_and_page_by_file_row_number(db, import_user_id):
    # arrange
    import_db = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )

    error = {"column": "TYPE", "code": "INVALID_TYPE", "message": "Type is unknown", "correction": None}
    await transaction_import_row_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {"import_id": import_db.id, "row_number": 7, "errors": [error]},
            {"import_id": import_db.id, "row_number": 5, "errors": []},
            {"import_id": import_db.id, "row_number": 3, "errors": [error]},
        ],
    )

    # act
    page = await get_rows(
        db=db,
        user_id=import_user_id,
        import_id=import_db.id,
        request=TransactionImportRowsRequest(page=2, size=1, has_errors=True),
    )

    # assert
    assert page.total == 2
    assert page.pages == 2
    assert [row.row_number for row in page.items] == [7]


async def test_report_returns_each_error_in_file_order(db, db_transaction, import_user_id):
    # arrange
    content = (
        ",".join(IMPORT_COLUMN_HEADERS.values()) + "\n"
        'Expense,2025-03-01,Card,Food,"12,50",EUR,,,,,,\n'
        "Adjustment,2025-03-02,Card,Extra,-5,EUR,,,,,,\n"
    ).encode()
    imported = await upload(
        db=db_transaction, user_id=import_user_id, file=UploadFile(file=BytesIO(content), filename="bank.csv")
    )
    await db_transaction.commit()

    # act
    report = await get_report(db=db, user_id=import_user_id, import_id=imported.id)

    # assert
    assert list(csv.reader(StringIO(report))) == [
        ["Row", "Column", "Problem", "Correction"],
        ["2", "Amount", "Amount uses a comma as the decimal separator", "12.50"],
        ["3", "To", "To is not allowed for Adjustment", ""],
    ]


async def test_upload_replaces_review_and_finds_last_applied_hash(db, db_transaction, import_user_id):
    # arrange
    content = (",".join(IMPORT_COLUMN_HEADERS.values()) + "\n").encode()
    file_hash = sha256(content).hexdigest()
    another_user = await user_crud.create(
        db=db, obj_in=UserCreate(username="other-import-user", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    original = {
        "user_id": import_user_id,
        "file_name": "bank.csv",
        "file_format": "CSV",
        "file_hash": file_hash,
        "ignored_columns": [],
    }
    old = await transaction_import_crud.create(
        db=db, obj_in={**original, "status": TransactionImportStatus.REVIEW}, commit=True
    )
    await transaction_import_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {**original, "status": "APPLIED", "updated_at": datetime(2025, 3, 1, tzinfo=UTC)},
            {**original, "status": "APPLIED", "updated_at": datetime(2025, 3, 2, tzinfo=UTC)},
            {
                **original,
                "status": "APPLIED",
                "updated_at": datetime(2025, 3, 3, tzinfo=UTC),
                "user_id": another_user.id,
            },
            {**original, "status": "APPLIED", "updated_at": datetime(2025, 3, 4, tzinfo=UTC), "file_hash": "a" * 64},
        ],
    )

    # act
    result = await upload(
        db=db_transaction, user_id=import_user_id, file=UploadFile(file=BytesIO(content), filename="new.csv")
    )
    await db_transaction.commit()

    # assert
    assert result.id != old.id
    assert result.already_imported_on == date(2025, 3, 2)
    await db.refresh(old)
    assert old.status == TransactionImportStatus.CANCELLED
    current = await get_current(db=db, user_id=import_user_id)
    assert current.id == result.id


async def test_bad_upload_keeps_existing_review(db, db_transaction, import_user_id):
    # arrange
    old = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )

    # act / assert
    with pytest.raises(ImportFileInvalid):
        await upload(
            db=db_transaction, user_id=import_user_id, file=UploadFile(file=BytesIO(b"bad"), filename="bank.csv")
        )

    current = await get_current(db=db, user_id=import_user_id)
    assert current.id == old.id


async def test_discard_clears_current_and_keeps_the_import_by_id(db, db_transaction, import_user_id):
    # arrange
    import_db = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )

    # act
    result = await discard(db=db_transaction, user_id=import_user_id, import_id=import_db.id)
    await db_transaction.commit()

    # assert
    assert result.status == TransactionImportStatus.CANCELLED
    await db.refresh(import_db)
    stored = await get_import(db=db, user_id=import_user_id, import_id=import_db.id)
    assert stored.status == TransactionImportStatus.CANCELLED
    with pytest.raises(EntityNotFound):
        await get_current(db=db, user_id=import_user_id)


@pytest.mark.parametrize("operation", [get_import, get_rows, get_report, discard])
async def test_import_endpoints_scope_access_to_owner(db, db_transaction, import_user_id, operation):
    # arrange
    import_db = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )
    kwargs = {"request": TransactionImportRowsRequest()} if operation is get_rows else {}

    # act / assert
    with pytest.raises(EntityNotFound):
        await operation(db=db_transaction, user_id=uuid4(), import_id=import_db.id, **kwargs)


async def test_concurrent_first_uploads_leave_one_open_import(db, db_transaction, other_db_transaction, import_user_id):
    # arrange
    content = (",".join(IMPORT_COLUMN_HEADERS.values()) + "\n").encode()
    first_file = UploadFile(file=BytesIO(content), filename="first.csv")
    second_file = UploadFile(file=BytesIO(content), filename="second.csv")
    async with asyncio.TaskGroup() as tasks:
        first = tasks.create_task(upload(db=db_transaction, user_id=import_user_id, file=first_file))
        second = tasks.create_task(upload(db=other_db_transaction, user_id=import_user_id, file=second_file))
        done, _ = await asyncio.wait((first, second), return_when=asyncio.FIRST_COMPLETED)
        if first in done:
            await db_transaction.commit()
            await second
            await other_db_transaction.commit()
        else:
            await other_db_transaction.commit()
            await first
            await db_transaction.commit()

    # assert
    current = await get_current(db=db, user_id=import_user_id)
    assert current.id in {first.result().id, second.result().id}
    previous = first.result() if second.result().id == current.id else second.result()
    stored = await get_import(db=db, user_id=import_user_id, import_id=previous.id)
    assert stored.status == TransactionImportStatus.CANCELLED


@pytest.mark.parametrize(
    ("assigned_rows", "last_account", "expected_issue", "expected_error"),
    [
        ([2, 3], None, ImportMatchIssue.UNASSIGNED, ImportMatchIssue.UNASSIGNED),
        (None, None, None, ImportRowErrorCode.SAME_ACCOUNT),
        ([2, 3], "second", None, None),
    ],
)
async def test_save_decisions_resolves_rows_recomputes_duplicates_and_clears_preview(
    db, db_transaction, import_user_id, assigned_rows, last_account, expected_issue, expected_error
):
    # arrange
    first, second = await account_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {"user_id": import_user_id, "name": "First card", "kind": AccountKind.ASSET, "currency": "EUR"},
            {"user_id": import_user_id, "name": "Second card", "kind": AccountKind.ASSET, "currency": "EUR"},
        ],
    )
    imported = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
            "preview": {"row_count": 3},
        },
    )
    rows = {"import_id": imported.id, "transaction_date": date(2025, 3, 1), "currency": "EUR", "errors": []}
    await transaction_import_row_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {**rows, "row_number": 2, "transaction_type": TransactionType.ADJUSTMENT, "amount": Decimal(-5)},
            {**rows, "row_number": 3, "transaction_type": TransactionType.ADJUSTMENT, "amount": Decimal(-5)},
            {
                **rows,
                "row_number": 4,
                "transaction_type": TransactionType.TRANSFER,
                "amount": Decimal(5),
                "to_name": first.name,
                "to_currency": "EUR",
            },
        ],
    )
    selection = ImportEntityDecision(
        kind=ImportEntityKind.MONEY_ACCOUNT,
        name=None,
        currency="EUR",
        row_numbers=assigned_rows,
        action=ImportEntityAction.USE_EXISTING,
        entity_id=first.id,
    )
    entities = [selection]
    duplicates = []
    if last_account == "second":
        entities.append(selection.model_copy(update={"entity_id": second.id, "row_numbers": [4]}))
        duplicates.append(ImportDuplicateDecision(row_number=3, is_kept=False))

    # act
    saved = await save_decisions(
        db=db_transaction,
        user_id=import_user_id,
        import_id=imported.id,
        request=ImportDecisionsRequest(entities=entities, duplicates=duplicates),
    )
    await db_transaction.commit()

    # assert
    assert saved.entities[0].issue == expected_issue
    assert saved.entities[0].decisions == entities
    assert saved.is_ready_for_preview == (expected_error is None)
    assert saved.error_row_count == int(expected_error is not None)
    assert saved.duplicate_row_count == 1
    assert saved.undecided_duplicate_count == int(last_account is None)
    await db.refresh(imported)
    assert imported.preview is None
    assert imported.decisions["duplicates"] == [entry.model_dump(mode="json") for entry in duplicates]
    stored_duplicate = await transaction_import_row_crud.get(db=db, import_id=imported.id, row_number=3)
    assert stored_duplicate.duplicate_row_number == 2
    assert stored_duplicate.is_kept is (False if last_account is not None else None)
    stored_transfer = await transaction_import_row_crud.get(db=db, import_id=imported.id, row_number=4)
    assert [error["code"] for error in stored_transfer.errors] == ([expected_error] if expected_error else [])


async def test_revised_upload_matches_only_active_owned_transactions_and_preserves_adjustment_sign(
    db, db_transaction, import_user_id
):
    # arrange
    card, category, equity = await account_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {"user_id": import_user_id, "name": "Card", "kind": AccountKind.ASSET, "currency": "EUR"},
            {"user_id": import_user_id, "name": "Food", "kind": AccountKind.EXPENSE},
            {"user_id": import_user_id, "name": "Adjustments", "kind": AccountKind.EQUITY},
        ],
    )
    location = await location_crud.create(db=db, commit=True, obj_in={"user_id": import_user_id, "name": "No location"})
    expense_fields = {
        "user_id": import_user_id,
        "transaction_type": TransactionType.EXPENSE,
        "base_currency_amount": None,
        "location_id": location.id,
    }
    expense, deleted, foreign, adjustment = await transaction_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {**expense_fields, "transaction_date": date(2025, 3, 1)},
            {**expense_fields, "transaction_date": date(2025, 3, 2), "status": EntityStatusType.DELETED},
            {**expense_fields, "transaction_date": date(2025, 3, 3), "user_id": uuid4()},
            {
                "user_id": import_user_id,
                "transaction_type": TransactionType.ADJUSTMENT,
                "transaction_date": date(2025, 3, 4),
                "base_currency_amount": Decimal(5),
            },
        ],
    )
    await posting_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {
                "transaction_id": transaction.id,
                "account_id": account_id,
                "amount": Decimal(amount),
                "currency": "EUR",
                "base_amount": None,
            }
            for transaction in (expense, deleted, foreign)
            for account_id, amount in ((card.id, -5), (category.id, 5))
        ]
        + [
            {
                "transaction_id": adjustment.id,
                "account_id": account_id,
                "amount": Decimal(amount),
                "currency": "EUR",
                "base_amount": Decimal(amount),
            }
            for account_id, amount in ((equity.id, -5), (card.id, 5))
        ],
    )
    content = (
        ",".join(IMPORT_COLUMN_HEADERS.values()) + "\n"
        "Expense,2025-03-01,Card,Food,5,EUR,,,,,,Revised comment\n"
        "Expense,2025-03-02,Card,Food,5,EUR,,,,,,\n"
        "Expense,2025-03-03,Card,Food,5,EUR,,,,,,\n"
        "Adjustment,2025-03-04,Card,,5,EUR,,,,,,\n"
        "Adjustment,2025-03-04,Card,,-5,EUR,,,,,,\n"
    ).encode()

    # act
    imported = await upload(
        db=db_transaction, user_id=import_user_id, file=UploadFile(file=BytesIO(content), filename="revised.csv")
    )
    await db_transaction.commit()

    # assert
    assert (imported.duplicate_row_count, imported.undecided_duplicate_count) == (2, 2)
    stored = await transaction_import_row_crud.get_rows(db=db, import_id=imported.id)
    assert [(row.row_number, row.duplicate_transaction_id, row.is_kept) for row in stored] == [
        (2, expense.id, None),
        (3, None, None),
        (4, None, None),
        (5, adjustment.id, None),
        (6, None, None),
    ]


@pytest.mark.parametrize("invalid_account", ["other owner", "wrong currency", "equity", "deleted"])
async def test_save_decisions_rejects_invalid_existing_accounts(db, db_transaction, import_user_id, invalid_account):
    # arrange
    account = await account_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": uuid4() if invalid_account == "other owner" else import_user_id,
            "name": "Alternate",
            "kind": AccountKind.EQUITY if invalid_account == "equity" else AccountKind.ASSET,
            "currency": {"wrong currency": "USD", "equity": None}.get(invalid_account, "EUR"),
            "status": EntityStatusType.DELETED if invalid_account == "deleted" else EntityStatusType.ACTIVE,
        },
    )
    imported = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )
    await transaction_import_row_crud.create(
        db=db,
        commit=True,
        obj_in={
            "import_id": imported.id,
            "row_number": 2,
            "transaction_type": TransactionType.ADJUSTMENT,
            "transaction_date": date(2025, 3, 1),
            "currency": "EUR",
            "from_name": "Card",
            "amount": Decimal(-5),
            "errors": [],
        },
    )
    request = ImportDecisionsRequest(
        entities=[
            ImportEntityDecision(
                kind=ImportEntityKind.MONEY_ACCOUNT,
                name="Card",
                currency="EUR",
                action=ImportEntityAction.USE_EXISTING,
                entity_id=account.id,
            )
        ],
        duplicates=[],
    )

    # act / assert
    with pytest.raises(ImportDecisionsInvalid):
        await save_decisions(db=db_transaction, user_id=import_user_id, import_id=imported.id, request=request)

    # assert
    await db.refresh(imported)
    assert imported.decisions is None


async def test_save_decisions_rejects_cancelled_import(db, db_transaction, import_user_id):
    # arrange
    imported = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.CANCELLED,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )

    # act / assert
    with pytest.raises(ImportInProgress):
        await save_decisions(
            db=db_transaction,
            user_id=import_user_id,
            import_id=imported.id,
            request=ImportDecisionsRequest(entities=[], duplicates=[]),
        )


@pytest.mark.parametrize(
    ("name", "has_unknown_classification", "is_valid"),
    [("Cash", False, True), ("Cash", True, False), ("Cash\x00", False, False)],
)
async def test_create_decisions_validate_account_fields_and_can_plan_a_new_entity(
    db, db_transaction, import_user_id, name, has_unknown_classification, is_valid
):
    # arrange
    imported = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
            "preview": {"row_count": 2},
        },
    )
    await transaction_import_row_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {
                "import_id": imported.id,
                "row_number": row_number,
                "transaction_type": TransactionType.ADJUSTMENT,
                "transaction_date": date(2025, 3, 1),
                "currency": "EUR",
                "from_name": from_name,
                "amount": Decimal(-5),
                "errors": [],
            }
            for row_number, from_name in ((2, "Card"), (3, "Cash"))
        ],
    )
    new_account = ImportEntityDecision(
        kind=ImportEntityKind.MONEY_ACCOUNT,
        name="Card",
        currency="EUR",
        action=ImportEntityAction.CREATE,
        new_entity=ImportNewEntity(
            name=name,
            currency="EUR",
            classification_id=uuid4() if has_unknown_classification else None,
        ),
    )
    request = ImportDecisionsRequest(entities=[new_account], duplicates=[])
    if not is_valid:
        # act / assert
        with pytest.raises(ImportDecisionsInvalid):
            await save_decisions(db=db_transaction, user_id=import_user_id, import_id=imported.id, request=request)

        await db.refresh(imported)
        assert imported.decisions is None
        assert imported.preview == {"row_count": 2}
        return

    # act
    saved = await save_decisions(db=db_transaction, user_id=import_user_id, import_id=imported.id, request=request)
    await db_transaction.commit()

    # assert
    assert saved.entities[0].decisions == [new_account]
    assert (saved.duplicate_row_count, saved.undecided_duplicate_count) == (1, 1)
    await db.refresh(imported)
    assert imported.decisions == request.model_dump(mode="json")
    assert await account_crud.get_user_accounts(db=db, user_id=import_user_id) == []


@pytest.mark.parametrize(("is_duplicate", "expected_rows"), [(True, [3]), (False, [2, 4])])
async def test_get_rows_filters_duplicates(db, import_user_id, is_duplicate, expected_rows):
    # arrange
    imported = await transaction_import_crud.create(
        db=db,
        commit=True,
        obj_in={
            "user_id": import_user_id,
            "status": TransactionImportStatus.REVIEW,
            "file_name": "bank.csv",
            "file_format": "CSV",
            "file_hash": "a" * 64,
            "ignored_columns": [],
        },
    )
    await transaction_import_row_crud.create_batch(
        db=db,
        commit=True,
        objs_in=[
            {
                "import_id": imported.id,
                "row_number": number,
                "transaction_type": TransactionType.ADJUSTMENT,
                "transaction_date": date(2025, 3, 1),
                "currency": "EUR",
                "from_name": "Card",
                "amount": Decimal(amount),
                "errors": [],
            }
            for number, amount in ((2, -5), (3, -5), (4, 5))
        ],
    )

    # act
    page = await get_rows(
        db=db,
        user_id=import_user_id,
        import_id=imported.id,
        request=TransactionImportRowsRequest(is_duplicate=is_duplicate),
    )

    # assert
    assert [row.row_number for row in page.items] == expected_rows
