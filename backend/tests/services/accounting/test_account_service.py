from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import expense_transaction_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import AccountDeletionForbidden
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountKindMismatch
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.transaction import ExpenseTransaction as ExpenseTransactionModel
from app.schemas.accounting.account import (
    Account,
    AccountCreate,
    AccountCreateRequest,
    AccountKind,
    AccountRequest,
    AccountUpdate,
    CategoryType,
)
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import account_service


@pytest.mark.parametrize("currency, expected_base_currency_rate", [("USD", Decimal("1")), ("EUR", Decimal("0"))])
async def test_create_account_ok(db_transaction: AsyncSession, currency: str, expected_base_currency_rate: Decimal):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", description="test description", currency=currency
    )
    # Act
    account: Account = await account_service.create_account(
        db=db_transaction, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db_transaction.commit()

    # Assert
    assert account.id is not None
    assert account.name == create_data.name
    assert account.description == create_data.description
    assert account.user_id == user_id
    assert account.balance == Decimal("0")
    assert account.currency == create_data.currency
    assert account.color is None
    assert account.base_currency_rate == expected_base_currency_rate
    assert account.status == EntityStatusType.ACTIVE


async def test_create_account_with_color(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", currency="USD", color="#2E8C7A"
    )

    # Act
    account: Account = await account_service.create_account(
        db=db_transaction, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db_transaction.commit()

    # Assert
    assert account.color == "#2E8C7A"

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account.id))
    assert account_db.color == "#2E8C7A"


async def test_create_account_unknown_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="XXX")

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.create_account(
            db=db_transaction, user_id=user_id, create_data=create_data, base_currency="USD"
        )

    await db_transaction.rollback()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    accounts_db: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(accounts_db) == 0


async def test_create_account_existing_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", description="test description", currency="USD"
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data, base_currency="USD")
    await db.commit()

    # Act
    with pytest.raises(IntegrityException) as exc:
        await account_service.create_account(
            db=db_transaction, create_data=create_data, user_id=user_id, base_currency="USD"
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Account integrity error: 23505 on accounts.account_unique_user_id_kind_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 1


async def test_get_accounts(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    # 25 accounts, more than the 10 the removed per-user limit allowed
    for i in range(25):
        create_data: AccountCreateRequest = AccountCreateRequest(
            kind=AccountKind.ASSET, name=f"Account {i:02}", currency="USD"
        )
        await account_service.create_account(db=db, user_id=user_id, create_data=create_data, base_currency="USD")
    deleted_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="Account deleted", currency="USD"
    )
    deleted_account: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=deleted_create_data, base_currency="USD"
    )
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await db.commit()

    request_p1: AccountRequest = AccountRequest(size=10, page=1)
    request_p3: AccountRequest = AccountRequest(size=10, page=3)

    # Act
    accounts_p1: Page[Account] = await account_service.get_accounts(db=db, request=request_p1, user_id=user_id)
    accounts_p3: Page[Account] = await account_service.get_accounts(db=db, request=request_p3, user_id=user_id)

    # Assert
    assert accounts_p1.total == 25
    assert accounts_p1.pages == 3
    assert [account.name for account in accounts_p1.items] == [f"Account {i:02}" for i in range(10)]

    assert accounts_p3.total == 25
    assert [account.name for account in accounts_p3.items] == [f"Account {i:02}" for i in range(20, 25)]


async def test_get_accounts_no_accounts(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    request: AccountRequest = AccountRequest()

    # Act
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_id)

    # Assert
    assert accounts.total == 0
    assert len(accounts.items) == 0


async def test_get_account_ok(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", description="test description", currency="USD"
    )
    account_created: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db.commit()

    # A balance in another currency with its rate, 14200.00 / 2.68 = 5298.51 in the base currency
    await account_crud.update_orm(
        db=db,
        obj_in={"balance": Decimal("14200.00"), "base_currency_rate": Decimal("2.68")},
        id=account_created.id,
        commit=True,
    )

    # Act
    account: Account = await account_service.get_account(db=db, account_id=account_created.id, user_id=user_id)

    await db.commit()

    # Assert
    assert account.id == account_created.id
    assert account.name == account_created.name
    assert account.description == account_created.description
    assert account.user_id == account_created.user_id
    assert account.balance == Decimal("14200.00")
    assert account.currency == account_created.currency
    assert account.base_currency_rate == Decimal("2.68")
    assert str(account.base_currency_balance) == "5298.51"
    assert account.status == account_created.status


async def test_get_account_not_found(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    account_id = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await account_service.get_account(db=db, account_id=account_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": account_id, "user_id": user_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_update_account_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", description="test description", currency="USD"
    )
    account_created: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="updated name", description="updated description")

    # Act
    account: Account = await account_service.update_account(
        db=db_transaction, account_id=account_created.id, user_id=user_id, update_data=update_data
    )
    await db_transaction.commit()

    # Assert
    assert account.id == account_created.id
    assert account.name == update_data.name
    assert account.description == update_data.description
    assert account.user_id == account_created.user_id
    assert account.balance == account_created.balance
    assert account.currency == account_created.currency
    assert account.base_currency_rate == account_created.base_currency_rate
    assert account.status == account_created.status


async def test_update_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    account_id = uuid4()

    update_data: AccountUpdate = AccountUpdate(name="updated name", description="updated description")

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await account_service.update_account(
            db=db_transaction, account_id=account_id, user_id=user_id, update_data=update_data
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": account_id, "user_id": user_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 0


async def test_update_account_double(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data_1: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 1", currency="USD")
    account_created_1: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data_1, base_currency="USD"
    )

    create_data_2: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 2", currency="USD")
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data_2, base_currency="USD")
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Account 2")

    # Act
    with pytest.raises(IntegrityException) as exc:
        await account_service.update_account(
            db=db_transaction, account_id=account_created_1.id, user_id=user_id, update_data=update_data
        )
        await db_transaction.commit()
        await db_transaction.close()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Account integrity error: 23505 on accounts.account_unique_user_id_kind_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 2


async def test_create_account_name_of_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
    deleted_account: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await db.commit()

    # Act
    account: Account = await account_service.create_account(
        db=db_transaction, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db_transaction.commit()

    # Assert
    assert account.id != deleted_account.id
    assert account.name == create_data.name
    assert account.status == EntityStatusType.ACTIVE

    accounts_db: list[AccountModel] = (
        await db.scalars(select(AccountModel).where(AccountModel.name == create_data.name))
    ).all()
    assert sorted(account_db.status for account_db in accounts_db) == [
        EntityStatusType.ACTIVE,
        EntityStatusType.DELETED,
    ]


async def test_update_account_name_of_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data_1: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 1", currency="USD")
    account_created_1: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data_1, base_currency="USD"
    )

    create_data_2: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 2", currency="USD")
    account_created_2: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data_2, base_currency="USD"
    )
    await account_service.delete_account(db=db, account_id=account_created_2.id, user_id=user_id)
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Account 2")

    # Act
    account: Account = await account_service.update_account(
        db=db_transaction, account_id=account_created_1.id, user_id=user_id, update_data=update_data
    )
    await db_transaction.commit()

    # Assert
    assert account.id == account_created_1.id
    assert account.name == update_data.name
    assert account.status == EntityStatusType.ACTIVE


async def test_restore_account_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
    account_created: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await account_service.delete_account(db=db, account_id=account_created.id, user_id=user_id)
    await db.commit()

    # Act
    account: Account = await account_service.restore_account(
        db=db_transaction, account_id=account_created.id, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert account.id == account_created.id
    assert account.name == account_created.name
    assert account.balance == Decimal("0")
    assert account.status == EntityStatusType.ACTIVE

    request: AccountRequest = AccountRequest()
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_id)
    assert [account.id for account in accounts.items] == [account_created.id]


async def test_restore_account_not_found(db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_id: UUID = uuid4()

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.restore_account(db=db_transaction, account_id=account_id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": account_id, "user_id": user_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_restore_account_active(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
    account_created: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db.commit()

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.restore_account(db=db_transaction, account_id=account_created.id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account_created.id))
    assert account_db.status == EntityStatusType.ACTIVE


async def test_restore_account_name_taken(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
    deleted_account: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data, base_currency="USD")
    await db.commit()

    # Act / Assert
    with pytest.raises(IntegrityException) as exc:
        await account_service.restore_account(db=db_transaction, account_id=deleted_account.id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Account integrity error: 23505 on accounts.account_unique_user_id_kind_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == deleted_account.id))
    assert account_db.status == EntityStatusType.DELETED


@pytest.mark.parametrize(
    "kind, category_type", [(AccountKind.EXPENSE, CategoryType.VARIABLE), (AccountKind.INCOME, None)]
)
async def test_create_account_without_currency_ok(
    db_transaction: AsyncSession, kind: AccountKind, category_type: CategoryType | None
):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=kind, name="Account", category_type=category_type)

    # Act
    account: Account = await account_service.create_account(
        db=db_transaction, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db_transaction.commit()

    # Assert
    assert account.kind == kind
    assert account.currency is None
    assert account.category_type == category_type
    assert account.balance == Decimal("0")
    assert account.base_currency_rate == Decimal("0")
    assert account.status == EntityStatusType.ACTIVE


async def test_create_account_same_name_other_kind(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    asset_create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Job", currency="USD")
    await account_service.create_account(db=db, user_id=user_id, create_data=asset_create_data, base_currency="USD")
    await db.commit()

    income_create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.INCOME, name="Job")

    # Act
    account: Account = await account_service.create_account(
        db=db_transaction, user_id=user_id, create_data=income_create_data, base_currency="USD"
    )
    await db_transaction.commit()

    # Assert
    assert account.kind == AccountKind.INCOME
    assert account.name == "Job"


async def test_get_accounts_kinds(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    income_create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.INCOME, name="Salary")
    await account_service.create_account(db=db, user_id=user_id, create_data=income_create_data, base_currency="USD")
    await db.commit()

    default_request: AccountRequest = AccountRequest(size=100)
    income_request: AccountRequest = AccountRequest(kinds=[AccountKind.INCOME, AccountKind.ASSET])
    equity_request: AccountRequest = AccountRequest(kinds=[AccountKind.EQUITY])

    # Act
    default_accounts: Page[Account] = await account_service.get_accounts(
        db=db, request=default_request, user_id=user_id
    )
    income_accounts: Page[Account] = await account_service.get_accounts(db=db, request=income_request, user_id=user_id)
    equity_accounts: Page[Account] = await account_service.get_accounts(db=db, request=equity_request, user_id=user_id)

    # Assert
    # Wallet, eight categories and Salary; Adjustments is listed only when EQUITY is asked for
    assert default_accounts.total == 10
    assert AccountKind.EQUITY not in {account.kind for account in default_accounts.items}
    assert [account.name for account in income_accounts.items] == ["Salary", "Wallet"]
    assert [account.name for account in equity_accounts.items] == ["Adjustments"]


async def test_get_accounts_search_term(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    await db.commit()

    request: AccountRequest = AccountRequest(search_term="out")

    # Act
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_id)

    # Assert
    assert [account.name for account in accounts.items] == ["Eating out"]


async def test_update_account_category_type_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.EXPENSE, name="Netflix", category_type=CategoryType.VARIABLE
    )
    account_created: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Netflix", category_type=CategoryType.FIXED)

    # Act
    account: Account = await account_service.update_account(
        db=db_transaction, account_id=account_created.id, user_id=user_id, update_data=update_data
    )
    await db_transaction.commit()

    # Assert
    assert account.category_type == CategoryType.FIXED

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account_created.id))
    assert account_db.category_type == CategoryType.FIXED


@pytest.mark.parametrize("kind, currency", [(AccountKind.ASSET, "USD"), (AccountKind.INCOME, None)])
async def test_update_account_category_type_mismatch(
    db: AsyncSession, db_transaction: AsyncSession, kind: AccountKind, currency: str | None
):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=kind, name="Account", currency=currency)
    account_created: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=create_data, base_currency="USD"
    )
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Updated", category_type=CategoryType.FIXED)

    # Act / Assert
    with pytest.raises(AccountKindMismatch) as exc:
        await account_service.update_account(
            db=db_transaction, account_id=account_created.id, user_id=user_id, update_data=update_data
        )
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.log_message == f"Account `{account_created.id}` is not an active account of kind EXPENSE"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account_created.id))
    assert account_db.name == "Account"
    assert account_db.category_type is None


async def test_update_account_equity(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    await db.commit()
    equity_db: AccountModel = await account_crud.get(db=db, user_id=user_id, kind=AccountKind.EQUITY)

    update_data: AccountUpdate = AccountUpdate(name="Renamed")

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.update_account(
            db=db_transaction, account_id=equity_db.id, user_id=user_id, update_data=update_data
        )
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    await db.refresh(equity_db)
    assert equity_db.name == "Adjustments"


async def test_delete_account_with_balance(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_create_data: dict = {
        "user_id": user_id,
        "kind": AccountKind.LIABILITY,
        "name": "Credit card",
        "currency": "USD",
        "balance": Decimal("-100.00"),
        "base_currency_rate": Decimal("1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    # Act / Assert
    with pytest.raises(AccountDeletionForbidden) as exc:
        await account_service.delete_account(db=db_transaction, account_id=account_db.id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_DELETION_FORBIDDEN

    await db.refresh(account_db)
    assert account_db.status == EntityStatusType.ACTIVE


async def test_delete_account_category_keeps_transactions(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    wallet_create_data: dict = {
        "user_id": user_id,
        "kind": AccountKind.ASSET,
        "name": "Wallet",
        "currency": "USD",
        "base_currency_rate": Decimal("1"),
    }
    wallet_db: AccountModel = await account_crud.create(db=db, obj_in=wallet_create_data, commit=True)
    category_create_data: dict = {
        "user_id": user_id,
        "kind": AccountKind.EXPENSE,
        "name": "Groceries",
        "category_type": CategoryType.VARIABLE,
    }
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )
    expense_create_data: dict = {
        "user_id": user_id,
        "transaction_type": TransactionType.EXPENSE,
        "transaction_date": date(2025, 2, 10),
        "base_currency_amount": Decimal("10"),
        "source_amount": Decimal("10"),
        "source_currency": "USD",
        "destination_amount": Decimal("10"),
        "destination_currency": "USD",
        "from_account_id": wallet_db.id,
        "category_id": category_db.id,
        "location_id": location_db.id,
    }
    expense_db: ExpenseTransactionModel = await expense_transaction_crud.create(
        db=db, obj_in=expense_create_data, commit=True
    )

    # Act
    account: Account = await account_service.delete_account(
        db=db_transaction, account_id=category_db.id, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert account.id == category_db.id
    assert account.status == EntityStatusType.DELETED

    expense_after_db: ExpenseTransactionModel = await db.scalar(
        select(ExpenseTransactionModel).where(ExpenseTransactionModel.id == expense_db.id)
    )
    assert expense_after_db.category_id == category_db.id
    assert expense_after_db.status == EntityStatusType.ACTIVE


async def test_delete_account_equity(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    await db.commit()
    equity_db: AccountModel = await account_crud.get(db=db, user_id=user_id, kind=AccountKind.EQUITY)

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.delete_account(db=db_transaction, account_id=equity_db.id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    await db.refresh(equity_db)
    assert equity_db.status == EntityStatusType.ACTIVE
