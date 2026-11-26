import asyncio
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.classification import classification_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import ClassificationReplacementRequired
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import InvalidClassificationReplacement
from app.schemas.accounting.account import AccountCreate, AccountKind, CategoryPurpose, CategoryType
from app.schemas.accounting.classification import ClassificationKind, ClassificationNameRequest
from app.schemas.base import EntityStatusType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.classification_service import (
    delete_classification,
    get_classifications,
    rename_classification,
)


async def test_rename_classification_keeps_assignment(
    db: AsyncSession, db_transaction: AsyncSession, account_owner_id: UUID
):
    # arrange
    kind = ClassificationKind.MONEY_ACCOUNT
    classification = await classification_crud.create(
        db=db, obj_in={"user_id": account_owner_id, "kind": kind, "name": "Checking"}, commit=True
    )
    account = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=account_owner_id,
            kind=AccountKind.ASSET,
            name="Current",
            currency="USD",
            classification_id=classification.id,
        ),
        commit=True,
    )

    # act
    renamed = await rename_classification(
        db=db_transaction,
        user_id=account_owner_id,
        kind=kind,
        classification_id=classification.id,
        update_data=ClassificationNameRequest(name=" Everyday "),
    )
    await db_transaction.commit()
    db.expunge_all()

    # assert
    stored_account = await account_crud.get(db=db, id=account.id, user_id=account_owner_id)
    classifications = await get_classifications(db=db, user_id=account_owner_id, kind=kind)
    assert stored_account.classification_id == renamed.id == classification.id
    assert renamed.name == "Everyday"
    assert [(row.name, row.is_default) for row in classifications] == [("Asset", True), (renamed.name, False)]


async def test_delete_default_classification_reassigns_archived_and_active_categories(
    db: AsyncSession, db_transaction: AsyncSession, account_owner_id: UUID
):
    # arrange
    kind = ClassificationKind.EXPENSE_CATEGORY
    default = await classification_crud.get(db=db, user_id=account_owner_id, kind=kind, is_default=True)
    active = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=account_owner_id,
            kind=AccountKind.EXPENSE,
            name="Groceries",
            category_type=CategoryType.FIXED,
            classification_id=default.id,
        ),
        commit=True,
    )
    archived = await account_crud.create(
        db=db,
        obj_in={
            "user_id": account_owner_id,
            "kind": AccountKind.EXPENSE,
            "name": "Supplies",
            "status": EntityStatusType.DELETED,
            "classification_id": active.classification_id,
            "category_type": CategoryType.PERIODIC,
            "category_purpose": CategoryPurpose.INCOME_COST,
        },
        commit=True,
    )
    replacement = await classification_crud.create(
        db=db, obj_in={"user_id": account_owner_id, "kind": kind, "name": "Household"}, commit=True
    )
    db.expunge_all()

    # act
    await delete_classification(
        db=db_transaction,
        user_id=account_owner_id,
        kind=kind,
        classification_id=active.classification_id,
        replacement_id=replacement.id,
    )
    await db_transaction.commit()

    # assert
    categories = await account_crud.get_user_accounts(db=db, user_id=account_owner_id)
    assert [
        (row.id, row.classification_id, row.category_type, row.category_purpose, row.status) for row in categories
    ] == [
        (active.id, replacement.id, CategoryType.FIXED, CategoryPurpose.PERSONAL, EntityStatusType.ACTIVE),
        (archived.id, replacement.id, CategoryType.PERIODIC, CategoryPurpose.INCOME_COST, EntityStatusType.DELETED),
    ]
    classifications = await get_classifications(db=db, user_id=account_owner_id, kind=kind)
    assert [(row.id, row.is_default) for row in classifications] == [(replacement.id, True)]


@pytest.mark.parametrize(
    "replacement, expected_exception",
    [
        ("missing", ClassificationReplacementRequired),
        ("same", InvalidClassificationReplacement),
        ("other_kind", EntityNotFound),
        ("other_user", EntityNotFound),
    ],
)
async def test_delete_classification_rejects_invalid_replacement(
    db: AsyncSession,
    db_transaction: AsyncSession,
    account_owner_id: UUID,
    replacement: str,
    expected_exception: type[Exception],
):
    # arrange
    kind = ClassificationKind.MONEY_ACCOUNT
    category_default = await classification_crud.get(
        db=db, user_id=account_owner_id, kind=ClassificationKind.EXPENSE_CATEGORY, is_default=True
    )
    in_use = await classification_crud.create(
        db=db, obj_in={"user_id": account_owner_id, "kind": kind, "name": "Cash"}, commit=True
    )
    await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=account_owner_id,
            kind=AccountKind.ASSET,
            name="Cash",
            currency="USD",
            classification_id=in_use.id,
        ),
        commit=True,
    )
    other_user = await user_crud.create(
        db=db, obj_in=UserCreate(username="other-owner", registration_provider=ProviderType.GOOGLE), commit=True
    )
    foreign_type = await classification_crud.create(
        db=db, obj_in={"user_id": other_user.id, "kind": kind, "name": "Savings"}, commit=True
    )
    replacement_ids = {
        "missing": None,
        "same": in_use.id,
        "other_kind": category_default.id,
        "other_user": foreign_type.id,
    }

    # act / assert
    with pytest.raises(expected_exception):
        await delete_classification(
            db=db_transaction,
            user_id=account_owner_id,
            kind=kind,
            classification_id=in_use.id,
            replacement_id=replacement_ids[replacement],
        )

    assert await classification_crud.get_or_none(db=db, id=in_use.id) is not None


async def test_replacement_locks_money_accounts_in_ledger_order(
    db: AsyncSession, db_transaction: AsyncSession, other_db_transaction: AsyncSession, account_owner_id: UUID
):
    # arrange
    kind = ClassificationKind.MONEY_ACCOUNT
    default = await classification_crud.get(db=db, user_id=account_owner_id, kind=kind, is_default=True)
    replacement = await classification_crud.create(
        db=db, obj_in={"user_id": account_owner_id, "kind": kind, "name": "Checking"}, commit=True
    )
    first_id, second_id = sorted([uuid4(), uuid4()])
    await account_crud.create_batch(
        db=db,
        objs_in=[
            {
                "id": second_id,
                "user_id": account_owner_id,
                "kind": AccountKind.ASSET,
                "name": "Second",
                "currency": "USD",
                "classification_id": default.id,
            },
            {
                "id": first_id,
                "user_id": account_owner_id,
                "kind": AccountKind.ASSET,
                "name": "First",
                "currency": "USD",
                "classification_id": default.id,
            },
        ],
        commit=True,
    )

    # Force heap order to differ from ledger order if replacement takes locks through an unordered UPDATE.
    await db_transaction.execute(text("SET LOCAL enable_indexscan = off"))
    await db_transaction.execute(text("SET LOCAL enable_bitmapscan = off"))
    replacement_pid: int = await db_transaction.scalar(text("SELECT pg_backend_pid()"))
    await other_db_transaction.execute(text("SET LOCAL lock_timeout = '1s'"))
    ledger_pid: int = await other_db_transaction.scalar(text("SELECT pg_backend_pid()"))
    await account_crud.get_locked_by_ids(db=other_db_transaction, ids=[first_id])
    blockers_query = text("SELECT pg_blocking_pids(:replacement_pid)")

    # act
    replace_task = asyncio.create_task(
        delete_classification(
            db=db_transaction,
            user_id=account_owner_id,
            kind=kind,
            classification_id=default.id,
            replacement_id=replacement.id,
        )
    )
    try:
        async with asyncio.timeout(5):
            while await db.scalar(blockers_query, {"replacement_pid": replacement_pid}) != [ledger_pid]:
                await asyncio.sleep(0.01)

        await account_crud.lock_money_accounts(db=other_db_transaction, user_id=account_owner_id)
    finally:
        await other_db_transaction.rollback()
        await replace_task

    await db_transaction.commit()

    # assert
    accounts = await account_crud.get_user_accounts(db=db, user_id=account_owner_id)
    assert [(account.id, account.classification_id) for account in accounts] == [
        (first_id, replacement.id),
        (second_id, replacement.id),
    ]
