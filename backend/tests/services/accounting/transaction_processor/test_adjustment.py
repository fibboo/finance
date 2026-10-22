from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountBalanceUnchanged, BaseCurrencyAmountNotAllowed
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.transaction import AdjustmentRequest, Transaction, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor


async def test_create_adjustment_increase_base_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("1250.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.transaction_date == adjustment_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.source_amount == Decimal("1250.00")
    assert transaction.source_currency == "USD"
    assert transaction.destination_amount == Decimal("1250.00")
    assert transaction.destination_currency == "USD"
    assert transaction.base_currency_amount == Decimal("1250.00")

    assert transaction.from_account_id is None
    assert transaction.from_account is None
    assert transaction.to_account_id == account_db.id
    assert transaction.to_account is not None
    assert transaction.category_id is None
    assert transaction.location_id is None
    assert transaction.income_source_id is None

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1250.00")
    assert account_db_after.base_currency_rate == Decimal("1")

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1


async def test_create_adjustment_decrease_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_currency_rate": Decimal("1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10),
        comment="Bank statement",
        account_id=account_db.id,
        new_balance=Decimal("400.00"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.comment == "Bank statement"
    assert transaction.source_amount == Decimal("600.00")
    assert transaction.destination_amount == Decimal("600.00")
    assert transaction.base_currency_amount == Decimal("600.00")
    assert transaction.from_account_id == account_db.id
    assert transaction.from_account is not None
    assert transaction.to_account_id is None
    assert transaction.to_account is None

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("400.00")
    assert account_db_after.base_currency_rate == Decimal("1")


async def test_create_adjustment_other_currency_with_rate_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("900"),
        "base_currency_rate": Decimal("0.9"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        new_balance=Decimal("1350.00"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # the account rate converts the difference
    assert transaction.source_amount == Decimal("450.00")
    assert transaction.source_currency == "EUR"
    assert transaction.destination_currency == "EUR"
    assert transaction.base_currency_amount == Decimal("500.00")
    assert transaction.to_account_id == account_db.id

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1350.00")
    assert account_db_after.base_currency_rate == Decimal("0.9000")


async def test_create_adjustment_other_currency_without_rate_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"user_id": user_id, "name": "Wallet EUR", "currency": "EUR"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        new_balance=Decimal("900.00"),
        base_currency_amount=Decimal("1000.00"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.source_amount == Decimal("900.00")
    assert transaction.base_currency_amount == Decimal("1000.00")
    assert transaction.to_account_id == account_db.id

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("900.00")
    assert account_db_after.base_currency_rate == Decimal("0.9000")


async def test_create_adjustment_other_currency_tiny_difference_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet RSD",
        "currency": "RSD",
        "balance": Decimal("1000"),
        "base_currency_rate": Decimal("117"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("1000.01")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # 0.01 / 117 rounds to 0.00, so the smallest positive amount is stored
    assert transaction.source_amount == Decimal("0.01")
    assert transaction.base_currency_amount == Decimal("0.01")
    assert transaction.to_account_id == account_db.id

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1000.01")
    assert account_db_after.base_currency_rate == Decimal("117")


async def test_create_adjustment_other_currency_crossing_zero_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Card RSD",
        "currency": "RSD",
        "balance": Decimal("-117.00"),
        "base_currency_rate": Decimal("117"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("0.01")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # 117.01 / 117 rounds to 1.00, which must not feed back into the rate
    assert transaction.source_amount == Decimal("117.01")
    assert transaction.base_currency_amount == Decimal("1.00")
    assert transaction.to_account_id == account_db.id

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0.01")
    assert account_db_after.base_currency_rate == Decimal("117")


async def test_create_adjustment_other_currency_decrease_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("900"),
        "base_currency_rate": Decimal("0.9"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("450.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.source_amount == Decimal("450.00")
    assert transaction.base_currency_amount == Decimal("500.00")
    assert transaction.from_account_id == account_db.id

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("450.00")
    assert account_db_after.base_currency_rate == Decimal("0.9")


@pytest.mark.parametrize(
    "currency, balance, base_currency_rate",
    [
        ("USD", Decimal("0"), Decimal("0")),
        ("USD", Decimal("0"), Decimal("1")),
        ("EUR", Decimal("900"), Decimal("0.9")),
    ],
)
async def test_create_adjustment_base_currency_amount_not_allowed(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    balance: Decimal,
    base_currency_rate: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": currency,
        "balance": balance,
        "base_currency_rate": base_currency_rate,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        new_balance=Decimal("1350.00"),
        base_currency_amount=Decimal("1"),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    with pytest.raises(BaseCurrencyAmountNotAllowed) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Base currency amount not allowed"
    assert exc.value.log_message == (
        f"A base_currency_amount of 1 was sent for account `{account_db.id}`, whose base currency amount is derived"
    )
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == balance


@pytest.mark.parametrize(
    "currency, base_currency_amount, base_currency_rate",
    [
        ("USD", None, Decimal("1")),
        ("EUR", Decimal("500.00"), Decimal("0.9000")),
    ],
)
async def test_create_adjustment_decrease_without_rate_ok(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    base_currency_amount: Decimal | None,
    base_currency_rate: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"user_id": user_id, "name": "Card", "currency": currency}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        new_balance=Decimal("-450.00"),
        base_currency_amount=base_currency_amount,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.source_amount == Decimal("450.00")
    assert transaction.from_account_id == account_db.id
    assert transaction.to_account_id is None

    # the account gets a rate, so expenses and transfers can debit it
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("-450.00")
    assert account_db_after.base_currency_rate == base_currency_rate


async def test_create_adjustment_other_currency_without_rate_and_base_amount(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"user_id": user_id, "name": "Wallet EUR", "currency": "EUR"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("900.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.log_message == f"Account {account_db.id} has no base currency rate. Try to make first deposit"
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


@pytest.mark.parametrize(
    "new_balance, base_currency_amount, base_currency_rate",
    [
        (Decimal("500.00"), Decimal("540.00"), Decimal("0.9259259259")),
        (Decimal("-450.00"), Decimal("500.00"), Decimal("0.9000")),
    ],
)
async def test_create_adjustment_emptied_account_restarts_rate(
    db: AsyncSession,
    db_transaction: AsyncSession,
    new_balance: Decimal,
    base_currency_amount: Decimal,
    base_currency_rate: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    # an expense emptied the account and left the rate of the money it spent
    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("0"),
        "base_currency_rate": Decimal("1.1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        new_balance=new_balance,
        base_currency_amount=base_currency_amount,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.source_amount == abs(new_balance)
    assert transaction.base_currency_amount == base_currency_amount

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == new_balance
    assert account_db_after.base_currency_rate == base_currency_rate


async def test_create_adjustment_emptied_account_without_base_amount(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    # an expense emptied the account and left the rate of the money it spent
    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("0"),
        "base_currency_rate": Decimal("1.1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("500.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.base_currency_rate == Decimal("1.1")


async def test_create_adjustment_emptied_base_currency_account_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("0"),
        "base_currency_rate": Decimal("1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("-300.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("300.00")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("-300.00")
    assert account_db_after.base_currency_rate == Decimal("1")


async def test_create_adjustment_balance_unchanged(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_currency_rate": Decimal("1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("1000.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    with pytest.raises(AccountBalanceUnchanged) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Account balance unchanged"
    assert exc.value.log_message == f"Account `{account_db.id}` already has the balance 1000"
    assert exc.value.log_level == LogLevelType.WARNING
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_BALANCE_UNCHANGED

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


async def test_create_adjustment_account_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"user_id": uuid4(), "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.log_message == f"Account not found by {{'id': UUID('{account_db.id}')}}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_create_adjustment_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "status": EntityStatusType.DELETED,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


@pytest.mark.parametrize(
    "balance_before, new_balance",
    [
        (Decimal("0"), Decimal("1250.00")),
        (Decimal("1000"), Decimal("400.00")),
        (Decimal("0"), Decimal("-500.00")),
    ],
)
async def test_delete_adjustment_ok(
    db: AsyncSession, db_transaction: AsyncSession, balance_before: Decimal, new_balance: Decimal
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": balance_before,
        "base_currency_rate": Decimal("1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=new_balance
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction_before: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == balance_before
    assert account_db_after.base_currency_rate == account_create_data["base_currency_rate"]


async def test_create_adjustment_base_currency_account_to_zero_keeps_rate(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_currency_rate": Decimal("1"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, new_balance=Decimal("0.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=adjustment_create_data.transaction_type
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("1000.00")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_currency_rate == Decimal("1")
