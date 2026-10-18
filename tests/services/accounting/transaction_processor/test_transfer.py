import asyncio
from copy import copy
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import UnprocessableException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountCreate
from app.schemas.accounting.transaction import Transaction, TransactionType, TransferRequest
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor


async def test_create_transfer_base_to_base_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "base_currency_rate": Decimal("1"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id, name="Checking USD", currency="USD")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal("1")
    assert transaction.source_currency == "USD"
    assert transaction.destination_amount == Decimal("1")
    assert transaction.destination_currency == "USD"
    assert transaction.base_currency_amount == Decimal("1")

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal("-1") != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal("1") != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal("1") != base_currency_to_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_base_to_other_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "base_currency_rate": Decimal("1"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id, name="Checking EUR", currency="EUR")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("105"),
        source_currency="USD",
        destination_currency="EUR",
        destination_amount=Decimal("100"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal("105")
    assert transaction.source_currency == "USD"
    assert transaction.destination_amount == Decimal("100")
    assert transaction.destination_currency == "EUR"
    assert transaction.base_currency_amount == Decimal("105")

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal("-105") != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal("100") != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal("0.9524") != base_currency_to_rate_before
    assert transaction.to_account.currency == transfer_create_data.destination_currency

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_other_to_base_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "base_currency_rate": Decimal("0.9524"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id, name="Checking USD", currency="USD")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("100"),
        source_currency="EUR",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal("100")
    assert transaction.source_currency == "EUR"
    assert transaction.destination_amount == Decimal("105")
    assert transaction.destination_currency == "USD"
    assert transaction.base_currency_amount == Decimal("105")

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal("-100") != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal("105") != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal("1") != base_currency_to_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_other_to_other_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "base_currency_rate": Decimal("0.9524"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: dict = {
        "user_id": user_db.id,
        "name": "Expense RSD",
        "currency": "RSD",
        "balance": Decimal("11100"),
        "base_currency_rate": Decimal("111"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("100"),
        source_currency="EUR",
        destination_currency="RSD",
        destination_amount=Decimal("11700"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal("100")
    assert transaction.source_currency == "EUR"
    assert transaction.destination_amount == Decimal("11700")
    assert transaction.destination_currency == "RSD"
    assert transaction.base_currency_amount == Decimal("105")

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal("-100") != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal("22800") != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal("111.2195") != base_currency_to_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_base_to_other_not_destination_amount(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "base_currency_rate": Decimal("1"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id, name="Checking EUR", currency="EUR")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_currency="EUR",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    with pytest.raises(UnprocessableException) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Unprocessable entity"
    assert exc.value.log_message == (
        "If destination_currency differs from user base currency, " "destination_amount must be specified"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.WARNING
    assert exc.value.error_code is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == account_from_balance_before
    assert account_from.base_currency_rate == base_currency_from_rate_before
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == account_to_balance_before
    assert account_to.base_currency_rate == base_currency_to_rate_before


async def test_create_transfer_other_to_other_not_base_rate(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income RSD",
        "currency": "RSD",
        "base_currency_rate": Decimal("117"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id, name="Checking EUR", currency="EUR")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="RSD",
        destination_currency="EUR",
        destination_amount=Decimal("117"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == "Accounts has no base currency rate"
    assert exc.value.log_message == f"Account {account_to_db.id} has no base currency rate. Try to make first deposit"
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == account_from_balance_before
    assert account_from.base_currency_rate == base_currency_from_rate_before
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == account_to_balance_before
    assert account_to.base_currency_rate == base_currency_to_rate_before


async def test_delete_other_to_other_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_currency_rate": Decimal("0.9524"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: dict = {
        "user_id": user_db.id,
        "name": "Expense RSD",
        "currency": "RSD",
        "balance": Decimal("11100"),
        "base_currency_rate": Decimal("111.0000"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("100"),
        source_currency="EUR",
        destination_currency="RSD",
        destination_amount=Decimal("11700"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    transaction_before: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_from_after: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_db_from_after.balance == Decimal("100") == account_from_balance_before
    assert account_db_from_after.base_currency_rate == Decimal("0.9524") == base_currency_from_rate_before

    account_db_to_after: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_db_to_after.balance == Decimal("11100") == account_to_balance_before
    assert account_db_to_after.base_currency_rate == Decimal("111.0000") == base_currency_to_rate_before


async def test_create_transfer_to_account_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    other_user_create_data: UserCreate = UserCreate(
        username="other", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    other_user_db: UserModel = await user_crud.create(db=db, obj_in=other_user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "base_currency_rate": Decimal("1"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)

    account_to_create_data: AccountCreate = AccountCreate(user_id=other_user_db.id, name="Checking USD", currency="USD")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == account_from_balance_before
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == account_to_balance_before


@pytest.mark.parametrize("is_from_account_deleted", [True, False])
async def test_create_transfer_deleted_account(
    db: AsyncSession, db_transaction: AsyncSession, is_from_account_deleted: bool
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("1"),
        "base_currency_rate": Decimal("1"),
        "status": EntityStatusType.DELETED if is_from_account_deleted else EntityStatusType.ACTIVE,
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "user_id": user_db.id,
        "name": "Checking USD",
        "currency": "USD",
        "status": EntityStatusType.ACTIVE if is_from_account_deleted else EntityStatusType.DELETED,
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    deleted_account_db: AccountModel = account_from_db if is_from_account_deleted else account_to_db

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN
    assert exc.value.log_message == (
        f"Account `{deleted_account_db.id}` is deleted. Restore it to create or delete its transactions"
    )

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("1")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("0")


@pytest.mark.parametrize("is_from_account_deleted", [True, False])
async def test_delete_deleted_account(db: AsyncSession, db_transaction: AsyncSession, is_from_account_deleted: bool):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("1"),
        "base_currency_rate": Decimal("1"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id, name="Checking USD", currency="USD")
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    deleted_account_db: AccountModel = account_from_db if is_from_account_deleted else account_to_db

    transfer_create_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=transfer_create_data.transaction_type
    )
    transaction_before: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db.commit()

    await account_crud.update_orm(
        db=db, id=deleted_account_db.id, obj_in={"status": EntityStatusType.DELETED.value}, commit=True
    )
    await db.close()

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.delete(transaction_id=transaction_before.id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN
    assert exc.value.log_message == (
        f"Account `{deleted_account_db.id}` is deleted. Restore it to create or delete its transactions"
    )

    transaction_db: TransactionModel = await db.scalar(
        select(TransactionModel).where(TransactionModel.id == transaction_before.id)
    )
    assert transaction_db.status == EntityStatusType.ACTIVE
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("0")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("1")


async def test_create_transfer_opposite_concurrent_no_deadlock(
    db: AsyncSession, db_transaction: AsyncSession, other_db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    first_account_create_data: dict = {
        "user_id": user_db.id,
        "name": "Checking USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_currency_rate": Decimal("1"),
    }
    first_account_db: AccountModel = await account_crud.create(db=db, obj_in=first_account_create_data, commit=True)
    second_account_create_data: dict = {
        "user_id": user_db.id,
        "name": "Savings USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_currency_rate": Decimal("1"),
    }
    second_account_db: AccountModel = await account_crud.create(db=db, obj_in=second_account_create_data, commit=True)
    lower_account_db, higher_account_db = sorted([first_account_db, second_account_db], key=lambda account: account.id)

    lower_to_higher_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=lower_account_db.id,
        to_account_id=higher_account_db.id,
    )
    higher_to_lower_data: TransferRequest = TransferRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("30"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=higher_account_db.id,
        to_account_id=lower_account_db.id,
    )
    first_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=lower_to_higher_data.transaction_type
    )
    second_processor: TransactionProcessor = factory.get_processor(
        db=other_db_transaction, user_id=user_db.id, transaction_type=higher_to_lower_data.transaction_type
    )
    waiting_on_lock_query: TextClause = text(
        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'"
    )

    # holding the lower account queues the first transfer on it, so locking from-then-to would deadlock
    await account_crud.get(db=db, id=lower_account_db.id, with_for_update=True)

    # Act
    first_create: asyncio.Task = asyncio.create_task(first_processor.create(data=lower_to_higher_data))

    async with asyncio.timeout(5):
        while not first_create.done() and await db.scalar(waiting_on_lock_query) < 1:
            await db.execute(text("SELECT pg_stat_clear_snapshot()"))
            await asyncio.sleep(0.01)

    second_create: asyncio.Task = asyncio.create_task(second_processor.create(data=higher_to_lower_data))

    async with asyncio.timeout(5):
        while not second_create.done() and await db.scalar(waiting_on_lock_query) < 2:
            await db.execute(text("SELECT pg_stat_clear_snapshot()"))
            await asyncio.sleep(0.01)

    await db.commit()
    await first_create
    await db_transaction.commit()
    await second_create
    await other_db_transaction.commit()

    # Assert
    lower_account_after: AccountModel = await account_crud.get(db=db, id=lower_account_db.id)
    await db.refresh(lower_account_after)
    higher_account_after: AccountModel = await account_crud.get(db=db, id=higher_account_db.id)
    await db.refresh(higher_account_after)
    assert lower_account_after.balance == Decimal("120")
    assert higher_account_after.balance == Decimal("80")

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 2
