from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.classification import classification_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import ClassificationReplacementRequired
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import InvalidClassificationReplacement
from app.schemas.accounting.account import AccountCreateRequest, AccountKind, CategoryPurpose, CategoryType
from app.schemas.accounting.classification import ClassificationKind, ClassificationNameRequest
from app.schemas.base import EntityStatusType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.account_service import create_account
from app.services.accounting.classification_service import (
    create_classification,
    delete_classification,
    get_classifications,
    rename_classification,
)


async def test_rename_classification_keeps_assignment(
    db: AsyncSession, db_transaction: AsyncSession, account_owner_id: UUID
):
    # arrange
    kind = ClassificationKind.MONEY_ACCOUNT
    classification = await create_classification(
        db=db, user_id=account_owner_id, kind=kind, create_data=ClassificationNameRequest(name="Checking")
    )
    account = await create_account(
        db=db,
        user_id=account_owner_id,
        create_data=AccountCreateRequest(
            kind=AccountKind.ASSET, name="Current", currency="USD", classification_id=classification.id
        ),
    )
    await db.commit()

    # act
    renamed = await rename_classification(
        db=db_transaction,
        user_id=account_owner_id,
        kind=kind,
        classification_id=classification.id,
        update_data=ClassificationNameRequest(name=" Everyday "),
    )
    await db_transaction.commit()

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
    active = await create_account(
        db=db,
        user_id=account_owner_id,
        create_data=AccountCreateRequest(kind=AccountKind.EXPENSE, name="Groceries", category_type=CategoryType.FIXED),
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
    )
    replacement = await create_classification(
        db=db, user_id=account_owner_id, kind=kind, create_data=ClassificationNameRequest(name="Household")
    )
    await db.commit()
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
    account = await create_account(
        db=db,
        user_id=account_owner_id,
        create_data=AccountCreateRequest(kind=AccountKind.ASSET, name="Cash", currency="USD"),
    )
    other_user = await user_crud.create(
        db=db, obj_in=UserCreate(username="other-owner", registration_provider=ProviderType.GOOGLE)
    )
    foreign_type = await create_classification(
        db=db, user_id=other_user.id, kind=kind, create_data=ClassificationNameRequest(name="Savings")
    )
    category_type = await create_classification(
        db=db,
        user_id=account_owner_id,
        kind=ClassificationKind.EXPENSE_CATEGORY,
        create_data=ClassificationNameRequest(name="Household"),
    )
    await db.commit()
    replacement_ids = {
        "missing": None,
        "same": account.classification_id,
        "other_kind": category_type.id,
        "other_user": foreign_type.id,
    }

    # act / assert
    with pytest.raises(expected_exception):
        await delete_classification(
            db=db_transaction,
            user_id=account_owner_id,
            kind=kind,
            classification_id=account.classification_id,
            replacement_id=replacement_ids[replacement],
        )

    assert await classification_crud.get_or_none(db=db, id=account.classification_id) is not None
