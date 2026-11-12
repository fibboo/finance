from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import (
    AccountKindMismatch,
    BaseCurrencyAmountNotAllowed,
    TransactionTypeChangeNotAllowed,
)
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountKind, AdjustmentCreate, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import MovementRequest, Transaction, TransactionType
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

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("1250.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.transaction_date == adjustment_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.base_currency_amount == Decimal("1250.00")
    assert transaction.location is None
    assert transaction.income_period is None
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-1250.00"), "USD", Decimal("-1250.00")),
        (account_db.id, Decimal("1250.00"), "USD", Decimal("1250.00")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1250.00")
    assert account_db_after.base_balance == Decimal("1250.00")

    # the increase is taken from the Adjustments account, whose cache stays untouched
    postings: list[PostingModel] = (await db.scalars(select(PostingModel).order_by(PostingModel.amount))).all()
    assert [(p.account_id, p.amount, p.currency, p.base_amount) for p in postings] == [
        (equity_db.id, Decimal("-1250.00"), "USD", Decimal("-1250.00")),
        (account_db.id, Decimal("1250.00"), "USD", Decimal("1250.00")),
    ]
    equity_db_after: AccountModel = await account_crud.get(db=db, id=equity_db.id)
    assert equity_db_after.balance == Decimal("0")
    assert equity_db_after.base_balance == Decimal("0")

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1


async def test_create_adjustment_decrease_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("1000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        comment="Bank statement",
        account_id=account_db.id,
        amount=Decimal("-600.00"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.comment == "Bank statement"
    assert transaction.base_currency_amount == Decimal("600.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_db.id, Decimal("-600.00"), "USD", Decimal("-600.00")),
        (equity_db.id, Decimal("600.00"), "USD", Decimal("600.00")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("400.00")
    assert account_db_after.base_balance == Decimal("400.00")

    postings: list[PostingModel] = (await db.scalars(select(PostingModel).order_by(PostingModel.amount))).all()
    assert [(p.account_id, p.amount, p.base_amount) for p in postings] == [
        (account_db.id, Decimal("-600.00"), Decimal("-600.00")),
        (equity_db.id, Decimal("600.00"), Decimal("600.00")),
    ]


async def test_create_adjustment_other_currency_with_rate_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    # 900 EUR worth 1000 USD is a rate of 0.9
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("900"),
        "base_balance": Decimal("1000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("450.00"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # the account rate converts the difference
    assert transaction.base_currency_amount == Decimal("500.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-450.00"), "EUR", Decimal("-500.00")),
        (account_db.id, Decimal("450.00"), "EUR", Decimal("500.00")),
    ]
    assert transaction.postings[1].account.base_currency_rate == Decimal("0.9")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1350.00")
    assert account_db_after.base_balance == Decimal("1500.00")


async def test_create_adjustment_other_currency_without_rate_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet EUR", "currency": "EUR"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("900.00"),
        base_currency_amount=Decimal("1000.00"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("1000.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-900.00"), "EUR", Decimal("-1000.00")),
        (account_db.id, Decimal("900.00"), "EUR", Decimal("1000.00")),
    ]
    assert transaction.postings[1].account.base_currency_rate == Decimal("0.9")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("900.00")
    assert account_db_after.base_balance == Decimal("1000.00")


async def test_create_adjustment_other_currency_tiny_difference_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet RSD",
        "currency": "RSD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("8.55"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("0.01")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # 0.01 * 8.55 / 1000 rounds to 0.00, so the smallest positive amount is stored
    assert transaction.base_currency_amount == Decimal("0.01")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-0.01"), "RSD", Decimal("-0.01")),
        (account_db.id, Decimal("0.01"), "RSD", Decimal("0.01")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1000.01")
    assert account_db_after.base_balance == Decimal("8.56")


async def test_create_adjustment_other_currency_crossing_zero_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Card RSD",
        "currency": "RSD",
        "balance": Decimal("-117.00"),
        "base_balance": Decimal("-1.00"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("117.01")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # 117.01 at the rate of 117 rounds to 1.00, which leaves the remaining 0.01 RSD without a base value
    assert transaction.base_currency_amount == Decimal("1.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-117.01"), "RSD", Decimal("-1.00")),
        (account_db.id, Decimal("117.01"), "RSD", Decimal("1.00")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0.01")
    assert account_db_after.base_balance == Decimal("0.00")


async def test_create_adjustment_other_currency_decrease_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("900"),
        "base_balance": Decimal("1000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("-450.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("500.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_db.id, Decimal("-450.00"), "EUR", Decimal("-500.00")),
        (equity_db.id, Decimal("450.00"), "EUR", Decimal("500.00")),
    ]
    assert transaction.postings[0].account.base_currency_rate == Decimal("0.9")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("450.00")
    assert account_db_after.base_balance == Decimal("500.00")


async def test_create_adjustment_other_currency_to_zero_takes_base_balance(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    # 1000 RSD worth 8.55 USD
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet RSD",
        "currency": "RSD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("8.55"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("-1000.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    # emptying the account takes all of its base value
    assert transaction.base_currency_amount == Decimal("8.55")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_db.id, Decimal("-1000.00"), "RSD", Decimal("-8.55")),
        (equity_db.id, Decimal("1000.00"), "RSD", Decimal("8.55")),
    ]
    assert transaction.postings[0].account.base_currency_rate == Decimal("0")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")


@pytest.mark.parametrize(
    "currency, balance, base_balance",
    [
        ("USD", Decimal("0"), Decimal("0")),
        ("EUR", Decimal("900"), Decimal("1000")),
    ],
)
async def test_create_adjustment_base_currency_amount_not_allowed(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    balance: Decimal,
    base_balance: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": currency,
        "balance": balance,
        "base_balance": base_balance,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("1350.00"),
        base_currency_amount=Decimal("1"),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
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
    assert account_db_after.base_balance == base_balance


@pytest.mark.parametrize(
    "currency, base_currency_amount, expected_base_balance",
    [
        ("USD", None, Decimal("-450.00")),
        ("EUR", Decimal("500.00"), Decimal("-500.00")),
    ],
)
async def test_create_adjustment_decrease_without_rate_ok(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    base_currency_amount: Decimal | None,
    expected_base_balance: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Card", "currency": currency}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("-450.00"),
        base_currency_amount=base_currency_amount,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_db.id, Decimal("-450.00"), currency, expected_base_balance),
        (equity_db.id, Decimal("450.00"), currency, -expected_base_balance),
    ]

    # the debt has a base value, so expenses and transfers can debit the account
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("-450.00")
    assert account_db_after.base_balance == expected_base_balance


async def test_create_adjustment_other_currency_without_rate_and_base_amount(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet EUR", "currency": "EUR"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("900.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
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


async def test_create_adjustment_emptied_base_currency_account_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("0"),
        "base_balance": Decimal("0"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("-300.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("300.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_db.id, Decimal("-300.00"), "USD", Decimal("-300.00")),
        (equity_db.id, Decimal("300.00"), "USD", Decimal("300.00")),
    ]
    assert transaction.postings[0].account.base_currency_rate == Decimal("1")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("-300.00")
    assert account_db_after.base_balance == Decimal("-300.00")


async def test_create_adjustment_without_equity_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_create_adjustment_account_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": uuid4(), "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
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

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "status": EntityStatusType.DELETED,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
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
    "currency, balance_before, base_balance_before, amount, base_currency_amount",
    [
        ("USD", Decimal("0"), Decimal("0"), Decimal("1250.00"), None),
        ("USD", Decimal("1000"), Decimal("1000"), Decimal("-600.00"), None),
        ("USD", Decimal("0"), Decimal("0"), Decimal("-500.00"), None),
        ("EUR", Decimal("900"), Decimal("1000"), Decimal("-900.00"), None),
        ("EUR", Decimal("0"), Decimal("0"), Decimal("900.00"), Decimal("1000.00")),
    ],
)
async def test_delete_adjustment_ok(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    balance_before: Decimal,
    base_balance_before: Decimal,
    amount: Decimal,
    base_currency_amount: Decimal | None,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": currency,
        "balance": balance_before,
        "base_balance": base_balance_before,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=amount,
        base_currency_amount=base_currency_amount,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
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

    # the postings stay, and the cache no longer counts them
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == balance_before
    assert account_db_after.base_balance == base_balance_before

    postings: list[PostingModel] = (await db.scalars(select(PostingModel))).all()
    assert len(postings) == 2


async def test_create_adjustment_base_currency_account_to_zero_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("1000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("-1000.00")
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("1000.00")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")


async def test_create_adjustment_category_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.EXPENSE,
        "user_id": user_id,
        "name": "Groceries",
        "category_type": CategoryType.VARIABLE,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(AccountKindMismatch) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.log_message == f"Account `{account_db.id}` is not an active account of kind ASSET, LIABILITY"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_create_adjustment_equity_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=equity_db.id, amount=Decimal("100.00")
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=adjustment_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


@pytest.mark.parametrize(
    "amount, new_amount, expected_balance",
    [
        (Decimal("250.00"), Decimal("-400.00"), Decimal("600.00")),
        (Decimal("-250.00"), Decimal("400.00"), Decimal("1400.00")),
    ],
)
async def test_update_adjustment_ok(
    db: AsyncSession,
    db_transaction: AsyncSession,
    amount: Decimal,
    new_amount: Decimal,
    expected_balance: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("1000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), comment="Bank statement", account_id=account_db.id, amount=amount
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction_before: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db.commit()
    await db.close()

    adjustment_update_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 8), account_id=account_db.id, amount=new_amount
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.update(
        transaction_id=transaction_before.id, data=adjustment_update_data
    )
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.id == transaction_before.id
    assert transaction.created_at == transaction_before.created_at
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.transaction_date == date(2025, 2, 8)
    assert transaction.comment is None
    assert transaction.base_currency_amount == Decimal("400.00")

    # an increase credits the account and a decrease debits it
    postings: list[PostingModel] = (await db.scalars(select(PostingModel).order_by(PostingModel.amount))).all()
    account_ids: list[UUID] = [account_db.id, equity_db.id] if new_amount < 0 else [equity_db.id, account_db.id]
    assert [(p.account_id, p.amount, p.currency, p.base_amount) for p in postings] == [
        (account_ids[0], Decimal("-400.00"), "USD", Decimal("-400.00")),
        (account_ids[1], Decimal("400.00"), "USD", Decimal("400.00")),
    ]
    assert [posting.account.id for posting in transaction.postings] == account_ids

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == expected_balance
    assert account_db_after.base_balance == expected_balance

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1


async def test_update_adjustment_new_date_revalues_later_postings(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)
    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet EUR", "currency": "EUR"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    category_create_data: dict = {
        "kind": AccountKind.EXPENSE,
        "user_id": user_id,
        "name": "Groceries",
        "category_type": CategoryType.VARIABLE,
    }
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )

    # 900 EUR worth 1000 USD on the 10th give the account its rate, which values the expense of the 12th at 100 USD
    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("900.00"),
        base_currency_amount=Decimal("1000.00"),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    adjustment_before: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db.commit()

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 12),
        source_amount=Decimal("90.00"),
        source_currency="EUR",
        destination_amount=Decimal("90.00"),
        destination_currency="EUR",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    expense_before: Transaction = await transaction_processor.create(data=expense_create_data)
    await db.commit()
    await db.close()

    # moved after the expense, the adjustment finds an account without a rate, so it brings its base amount
    adjustment_update_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 14),
        account_id=account_db.id,
        amount=Decimal("900.00"),
        base_currency_amount=Decimal("1200.00"),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction: Transaction = await transaction_processor.update(
        transaction_id=adjustment_before.id, data=adjustment_update_data
    )
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert expense_before.base_currency_amount == Decimal("100.00")
    assert transaction.id == adjustment_before.id
    assert transaction.transaction_date == date(2025, 2, 14)
    assert transaction.base_currency_amount == Decimal("1200.00")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-900.00"), "EUR", Decimal("-1200.00")),
        (account_db.id, Decimal("900.00"), "EUR", Decimal("1200.00")),
    ]

    # the expense now comes before any rate and an adjustment values no waiting expense, so it is unvalued again
    expense_db_after: TransactionModel = await transaction_crud.get(db=db, id=expense_before.id)
    assert expense_db_after.base_currency_amount is None
    assert expense_db_after.valued_on is None
    expense_postings: list[PostingModel] = (
        await db.scalars(
            select(PostingModel).where(PostingModel.transaction_id == expense_before.id).order_by(PostingModel.amount)
        )
    ).all()
    assert [(p.account_id, p.amount, p.base_amount) for p in expense_postings] == [
        (account_db.id, Decimal("-90.00"), None),
        (category_db.id, Decimal("90.00"), None),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("810.00")
    assert account_db_after.base_balance == Decimal("1200.00")


async def test_update_adjustment_base_currency_amount_not_allowed(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    # 900 EUR worth 1000 USD: the account keeps a rate without the adjustment
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("900"),
        "base_balance": Decimal("1000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("450.00")
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction_before: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db.commit()
    await db.close()

    adjustment_update_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("90.00"),
        base_currency_amount=Decimal("1"),
    )

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(BaseCurrencyAmountNotAllowed) as exc:
        await transaction_processor.update(transaction_id=transaction_before.id, data=adjustment_update_data)

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.log_message == (
        f"A base_currency_amount of 1 was sent for account `{account_db.id}`, whose base currency amount is derived"
    )
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED

    transaction_db_after: TransactionModel = await transaction_crud.get(db=db, id=transaction_before.id)
    assert transaction_db_after.base_currency_amount == Decimal("500.00")
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1350.00")
    assert account_db_after.base_balance == Decimal("1500.00")


async def test_update_adjustment_without_rate_and_base_amount(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)
    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet EUR", "currency": "EUR"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    # the adjustment is the account's only rate, so the account has none without it
    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10),
        account_id=account_db.id,
        amount=Decimal("900.00"),
        base_currency_amount=Decimal("1000.00"),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction_before: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db.commit()
    await db.close()

    adjustment_update_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("800.00")
    )

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.update(transaction_id=transaction_before.id, data=adjustment_update_data)

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("900.00")
    assert account_db_after.base_balance == Decimal("1000.00")


async def test_update_adjustment_movement_type_change_not_allowed(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)
    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_source_create_data: dict = {"kind": AccountKind.INCOME, "user_id": user_id, "name": "Salary"}
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        income_period=date(2025, 2, 1),
        source_amount=Decimal("300.00"),
        source_currency="USD",
        destination_amount=Decimal("300.00"),
        destination_currency="USD",
        from_account_id=income_source_db.id,
        to_account_id=account_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    income_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    adjustment_update_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("100.00")
    )

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(TransactionTypeChangeNotAllowed) as exc:
        await transaction_processor.update(transaction_id=income_before.id, data=adjustment_update_data)

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.log_message == (
        f"The INCOME transaction `{income_before.id}` can not become a ADJUSTMENT transaction"
    )
    assert exc.value.error_code == ErrorCodeType.TRANSACTION_TYPE_CHANGE_NOT_ALLOWED

    transaction_types: list[TransactionType] = (await db.scalars(select(TransactionModel.transaction_type))).all()
    assert transaction_types == [TransactionType.INCOME]
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("300.00")


async def test_update_adjustment_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    equity_create_data: dict = {"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)
    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("100.00")
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    transaction_before: Transaction = await transaction_processor.create(data=adjustment_create_data)
    await db.commit()
    await account_crud.update_api(db=db, db_obj=account_db, obj_in={"status": EntityStatusType.DELETED}, commit=True)
    await db.close()

    adjustment_update_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=date(2025, 2, 10), account_id=account_db.id, amount=Decimal("50.00")
    )

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.update(transaction_id=transaction_before.id, data=adjustment_update_data)

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("100.00")
    transaction_db_after: TransactionModel = await transaction_crud.get(db=db, id=transaction_before.id)
    assert transaction_db_after.base_currency_amount == Decimal("100.00")
