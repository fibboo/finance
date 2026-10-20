from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.account import Account, AccountCreateRequest, AccountRequest, AccountUpdate
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import account_service


async def test_create_account_ok(db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        name="test name", description="test description", currency="USD"
    )
    # Act
    account: Account = await account_service.create_account(db=db_transaction, user_id=user_id, create_data=create_data)
    await db_transaction.commit()

    # Assert
    assert account.id is not None
    assert account.name == create_data.name
    assert account.description == create_data.description
    assert account.user_id == user_id
    assert account.balance == Decimal("0")
    assert account.currency == create_data.currency
    assert account.base_currency_rate == Decimal("0")
    assert account.status == EntityStatusType.ACTIVE


async def test_create_account_unknown_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name="test name", currency="XXX")

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.create_account(db=db_transaction, user_id=user_id, create_data=create_data)

    await db_transaction.rollback()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    accounts_db: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(accounts_db) == 0


async def test_create_account_existing_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        name="test name", description="test description", currency="USD"
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # Act
    with pytest.raises(IntegrityException) as exc:
        await account_service.create_account(db=db_transaction, create_data=create_data, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Account integrity error: 23505 on accounts.account_unique_user_id_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 1


async def test_get_accounts(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    # 25 accounts, more than the 10 the removed per-user limit allowed
    for i in range(25):
        create_data: AccountCreateRequest = AccountCreateRequest(name=f"Account {i:02}", currency="USD")
        await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    deleted_create_data: AccountCreateRequest = AccountCreateRequest(name="Account deleted", currency="USD")
    deleted_account: Account = await account_service.create_account(
        db=db, user_id=user_id, create_data=deleted_create_data
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
        name="test name", description="test description", currency="USD"
    )
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # Act
    account: Account = await account_service.get_account(db=db, account_id=account_created.id, user_id=user_id)

    await db.commit()

    # Assert
    assert account.id == account_created.id
    assert account.name == account_created.name
    assert account.description == account_created.description
    assert account.user_id == account_created.user_id
    assert account.balance == account_created.balance
    assert account.currency == account_created.currency
    assert account.base_currency_rate == account_created.base_currency_rate
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
        name="test name", description="test description", currency="USD"
    )
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
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
    create_data_1: AccountCreateRequest = AccountCreateRequest(name="Account 1", currency="USD")
    account_created_1: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data_1)

    create_data_2: AccountCreateRequest = AccountCreateRequest(name="Account 2", currency="USD")
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data_2)
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
    assert exc.value.log_message == "Account integrity error: 23505 on accounts.account_unique_user_id_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 2


async def test_create_account_name_of_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name="test name", currency="USD")
    deleted_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await db.commit()

    # Act
    account: Account = await account_service.create_account(db=db_transaction, user_id=user_id, create_data=create_data)
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
    create_data_1: AccountCreateRequest = AccountCreateRequest(name="Account 1", currency="USD")
    account_created_1: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data_1)

    create_data_2: AccountCreateRequest = AccountCreateRequest(name="Account 2", currency="USD")
    account_created_2: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data_2)
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
    create_data: AccountCreateRequest = AccountCreateRequest(name="test name", currency="USD")
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
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
    create_data: AccountCreateRequest = AccountCreateRequest(name="test name", currency="USD")
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
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
    create_data: AccountCreateRequest = AccountCreateRequest(name="test name", currency="USD")
    deleted_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # Act / Assert
    with pytest.raises(IntegrityException) as exc:
        await account_service.restore_account(db=db_transaction, account_id=deleted_account.id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Account integrity error: 23505 on accounts.account_unique_user_id_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == deleted_account.id))
    assert account_db.status == EntityStatusType.DELETED
