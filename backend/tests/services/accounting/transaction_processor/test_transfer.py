import asyncio
from copy import copy
from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import func, select, Select, text, TextClause
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import (
    BaseCurrencyAmountNotAllowed,
    DestinationAmountNotAllowed,
    FieldNotAllowed,
    TransferAmountMismatch,
    UnprocessableException,
)
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import (
    AccountCreate,
    AccountKind,
    AdjustmentCreate,
    CategoryType,
    MONEY_ACCOUNT_KINDS,
)
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import MovementRequest, Transaction, TransactionCreate, TransactionType
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
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Checking USD", currency="USD"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)

    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.base_currency_amount == Decimal("1")
    assert transaction.location is None
    assert transaction.income_period is None

    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_from_db.id, Decimal("-1"), "USD", Decimal("-1")),
        (account_to_db.id, Decimal("1"), "USD", Decimal("1")),
    ]

    assert transaction.postings[0].account.balance == Decimal("-1") != account_from_balance_before
    assert transaction.postings[0].account.base_currency_balance == Decimal("-1")
    assert transaction.postings[0].account.base_currency_rate == Decimal("1")

    assert transaction.postings[1].account.balance == Decimal("1") != account_to_balance_before
    assert transaction.postings[1].account.base_currency_balance == Decimal("1")
    assert transaction.postings[1].account.base_currency_rate == Decimal("1")

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_base_to_other_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Checking EUR", currency="EUR"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)

    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.base_currency_amount == Decimal("105")
    assert transaction.location is None
    assert transaction.income_period is None

    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_from_db.id, Decimal("-105"), "USD", Decimal("-105")),
        (account_to_db.id, Decimal("100"), "EUR", Decimal("105")),
    ]

    assert transaction.postings[0].account.balance == Decimal("-105") != account_from_balance_before
    assert transaction.postings[0].account.base_currency_balance == Decimal("-105")
    assert transaction.postings[0].account.base_currency_rate == Decimal("1")

    assert transaction.postings[1].account.balance == Decimal("100") != account_to_balance_before
    assert transaction.postings[1].account.base_currency_balance == Decimal("105")
    assert transaction.postings[1].account.base_currency_rate == Decimal("0.9523809524")

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_to_negative_account_adds_base_amount(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("1000"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("-55"),
        "base_balance": Decimal("-50"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    equity_account_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_db.id, kind=AccountKind.EQUITY, name="Adjustments"), commit=True
    )

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("105"),
        source_currency="USD",
        destination_currency="EUR",
        destination_amount=Decimal("100"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("105")

    # the credit repays the debt of -55 EUR worth -50 USD and leaves 45 EUR at its own rate, 47.25 USD,
    # so the -7.75 USD left over by the debt's rate goes to the EQUITY account
    exchange_postings: list[tuple[UUID, Decimal, Decimal]] = sorted(
        (posting.account.id, posting.amount, posting.base_amount) for posting in transaction.postings[2:]
    )
    assert exchange_postings == sorted(
        [(account_to_db.id, Decimal("0"), Decimal("-7.75")), (equity_account_db.id, Decimal("0"), Decimal("7.75"))]
    )

    account_to_db_after: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to_db_after.balance == Decimal("45")
    assert account_to_db_after.base_balance == Decimal("47.25")


async def test_create_transfer_other_to_base_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("1000"),
        "base_balance": Decimal("1050"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Checking USD", currency="USD"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)

    # 100 of 1000 EUR worth 1050 USD is 105 USD
    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.base_currency_amount == Decimal("105")
    assert transaction.location is None
    assert transaction.income_period is None

    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_from_db.id, Decimal("-100"), "EUR", Decimal("-105")),
        (account_to_db.id, Decimal("105"), "USD", Decimal("105")),
    ]

    assert transaction.postings[0].account.balance == Decimal("900") != account_from_balance_before
    assert transaction.postings[0].account.base_currency_balance == Decimal("945")
    assert transaction.postings[0].account.base_currency_rate == Decimal("0.9523809524")

    assert transaction.postings[1].account.balance == Decimal("105") != account_to_balance_before
    assert transaction.postings[1].account.base_currency_balance == Decimal("105")
    assert transaction.postings[1].account.base_currency_rate == Decimal("1")

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_other_to_other_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("1000"),
        "base_balance": Decimal("1050"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Expense RSD",
        "currency": "RSD",
        "balance": Decimal("11100"),
        "base_balance": Decimal("100"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)

    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.base_currency_amount == Decimal("105")
    assert transaction.location is None
    assert transaction.income_period is None

    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_from_db.id, Decimal("-100"), "EUR", Decimal("-105")),
        (account_to_db.id, Decimal("11700"), "RSD", Decimal("105")),
    ]

    assert transaction.postings[0].account.balance == Decimal("900") != account_from_balance_before
    assert transaction.postings[0].account.base_currency_rate == Decimal("0.9523809524")

    # 22800 RSD worth 100 + 105 USD
    assert transaction.postings[1].account.balance == Decimal("22800") != account_to_balance_before
    assert transaction.postings[1].account.base_currency_balance == Decimal("205")
    assert transaction.postings[1].account.base_currency_rate == Decimal("111.2195121951")

    postings: list[PostingModel] = (
        await db.scalars(select(PostingModel).where(PostingModel.transaction_id == transaction.id))
    ).all()
    posting_values: set[tuple] = {
        (posting.account_id, posting.amount, posting.currency, posting.base_amount) for posting in postings
    }
    assert posting_values == {
        (account_from_db.id, Decimal("-100"), "EUR", Decimal("-105")),
        (account_to_db.id, Decimal("11700"), "RSD", Decimal("105")),
    }


async def test_create_transfer_other_to_other_tiny_amount_keeps_a_cent(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Wallet RSD",
        "currency": "RSD",
        "balance": Decimal("1000"),
        "base_balance": Decimal("8.55"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Wallet EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("111.11"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    # 0.50 of 1000 RSD worth 8.55 USD is 0.0042... USD, which rounds below a cent
    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("0.50"),
        source_currency="RSD",
        destination_currency="EUR",
        destination_amount=Decimal("0.01"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("0.01")
    assert transaction.postings[0].account.balance == Decimal("999.50")
    assert transaction.postings[0].account.base_currency_balance == Decimal("8.54")
    assert transaction.postings[1].account.balance == Decimal("100.01")
    assert transaction.postings[1].account.base_currency_balance == Decimal("111.12")

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


async def test_create_transfer_base_to_other_not_destination_amount(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    account_from_base_balance_before: Decimal = copy(account_from_db.base_balance)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Checking EUR", currency="EUR"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    account_to_base_balance_before: Decimal = copy(account_to_db.base_balance)

    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(UnprocessableException) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Unprocessable entity"
    assert exc.value.log_message == (
        "If destination_currency differs from user base currency and from source_currency, "
        "destination_amount must be specified"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.WARNING
    assert exc.value.error_code is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == account_from_balance_before
    assert account_from.base_balance == account_from_base_balance_before
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == account_to_balance_before
    assert account_to.base_balance == account_to_base_balance_before


# 100 of 900 EUR worth 1000 USD is 111.11 USD; 0.05 EUR is 0.0555... USD, kept as 0.06, and the receiving
# account's rate follows from that base value in cents: 5.85 / 0.06 is 97.5
@pytest.mark.parametrize(
    "source_amount, destination_amount, expected_base_currency_amount, expected_from_balance, "
    "expected_from_base_balance, expected_to_rate",
    [
        (
            Decimal("100"),
            Decimal("11700"),
            Decimal("111.11"),
            Decimal("800"),
            Decimal("888.89"),
            Decimal("105.3010530105"),
        ),
        (
            Decimal("0.05"),
            Decimal("5.85"),
            Decimal("0.06"),
            Decimal("899.95"),
            Decimal("999.94"),
            Decimal("97.5"),
        ),
    ],
)
async def test_create_transfer_other_to_other_to_account_without_rate_ok(
    db: AsyncSession,
    db_transaction: AsyncSession,
    source_amount: Decimal,
    destination_amount: Decimal,
    expected_base_currency_amount: Decimal,
    expected_from_balance: Decimal,
    expected_from_base_balance: Decimal,
    expected_to_rate: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("900"),
        "base_balance": Decimal("1000"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Checking RSD", currency="RSD"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=source_amount,
        source_currency="EUR",
        destination_currency="RSD",
        destination_amount=destination_amount,
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == expected_base_currency_amount
    assert transaction.postings[1].account.base_currency_rate == expected_to_rate

    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == expected_from_balance
    assert account_from.base_balance == expected_from_base_balance
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == destination_amount
    assert account_to.base_balance == expected_base_currency_amount


async def test_create_transfer_from_empty_account_without_rate(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Card EUR", currency="EUR"
    )
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Savings EUR", currency="EUR"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="EUR",
        destination_currency="EUR",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("0")


async def test_delete_other_to_other_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("105"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Expense RSD",
        "currency": "RSD",
        "balance": Decimal("11100"),
        "base_balance": Decimal("100"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    # 50 of 100 EUR worth 105 USD is 52.50 USD
    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("50"),
        source_currency="EUR",
        destination_currency="RSD",
        destination_amount=Decimal("5850"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
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
    assert transaction_before.base_currency_amount == Decimal("52.50")
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_from_after: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_db_from_after.balance == Decimal("100")
    assert account_db_from_after.base_balance == Decimal("105")

    account_db_to_after: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_db_to_after.balance == Decimal("11100")
    assert account_db_to_after.base_balance == Decimal("100")


async def test_delete_transfer_that_emptied_account_restores_base_balance(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("110"),
        "base_balance": Decimal("100.01"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Wallet",
        "currency": "USD",
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    # the whole balance takes the whole base value, 100.01 USD
    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("110"),
        source_currency="EUR",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction_before: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction_before.base_currency_amount == Decimal("100.01")
    assert transaction_before.postings[1].amount == Decimal("100.01")
    assert transaction_before.postings[0].account.balance == Decimal("0")
    assert transaction_before.postings[0].account.base_currency_balance == Decimal("0")

    account_db_from_after: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_db_from_after.balance == Decimal("110")
    assert account_db_from_after.base_balance == Decimal("100.01")

    account_db_to_after: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_db_to_after.balance == Decimal("0")
    assert account_db_to_after.base_balance == Decimal("0")


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
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=other_user_db.id, name="Checking USD", currency="USD"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)

    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
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
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("1"),
        "base_balance": Decimal("1"),
        "status": EntityStatusType.DELETED if is_from_account_deleted else EntityStatusType.ACTIVE,
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Checking USD",
        "currency": "USD",
        "status": EntityStatusType.ACTIVE if is_from_account_deleted else EntityStatusType.DELETED,
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    deleted_account_db: AccountModel = account_from_db if is_from_account_deleted else account_to_db

    transfer_create_data: MovementRequest = MovementRequest(
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
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
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
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("1"),
        "base_balance": Decimal("1"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Checking USD", currency="USD"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    deleted_account_db: AccountModel = account_from_db if is_from_account_deleted else account_to_db

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        comment="test",
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
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
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Checking USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    first_account_db: AccountModel = await account_crud.create(db=db, obj_in=first_account_create_data, commit=True)
    second_account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Savings USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    second_account_db: AccountModel = await account_crud.create(db=db, obj_in=second_account_create_data, commit=True)
    lower_account_db, higher_account_db = sorted([first_account_db, second_account_db], key=lambda account: account.id)

    lower_to_higher_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=lower_account_db.id,
        to_account_id=higher_account_db.id,
    )
    higher_to_lower_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("30"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=higher_account_db.id,
        to_account_id=lower_account_db.id,
    )
    first_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    second_processor: TransactionProcessor = factory.get_processor(
        db=other_db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
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
    assert lower_account_after.base_balance == Decimal("120")
    assert higher_account_after.balance == Decimal("80")
    assert higher_account_after.base_balance == Decimal("80")

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 2


@pytest.mark.parametrize("destination_amount", [None, Decimal("55")])
async def test_create_transfer_same_currency_ok(
    db: AsyncSession, db_transaction: AsyncSession, destination_amount: Decimal | None
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("110"),
        "base_balance": Decimal("100"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Savings EUR",
        "currency": "EUR",
        "balance": Decimal("11"),
        "base_balance": Decimal("10"),
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("55"),
        source_currency="EUR",
        destination_currency="EUR",
        destination_amount=destination_amount,
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("50")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_from_db.id, Decimal("-55"), "EUR", Decimal("-50")),
        (account_to_db.id, Decimal("55"), "EUR", Decimal("50")),
    ]
    assert transaction.postings[0].account.base_currency_rate == Decimal("1.1")
    assert transaction.postings[1].account.base_currency_rate == Decimal("1.1")

    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("55")
    assert account_from.base_balance == Decimal("50")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("66")
    assert account_to.base_balance == Decimal("60")


@pytest.mark.parametrize(
    "currency, from_base_balance, to_base_balance",
    [("USD", Decimal("110"), Decimal("11")), ("EUR", Decimal("100"), Decimal("10"))],
)
async def test_create_transfer_same_currency_amount_mismatch(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    from_base_balance: Decimal,
    to_base_balance: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card",
        "currency": currency,
        "balance": Decimal("110"),
        "base_balance": from_base_balance,
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Savings",
        "currency": currency,
        "balance": Decimal("11"),
        "base_balance": to_base_balance,
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("100"),
        source_currency=currency,
        destination_currency=currency,
        destination_amount=Decimal("50"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(TransferAmountMismatch) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Transfer amount mismatch"
    assert exc.value.log_message == "A transfer sent destination_amount 50, while its currencies give 100"
    assert exc.value.log_level == LogLevelType.WARNING
    assert exc.value.error_code == ErrorCodeType.TRANSFER_AMOUNT_MISMATCH

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("110")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("11")


# 1 of 110 EUR worth 100 USD is 0.91 USD; a receiving account whose balance crosses zero
# keeps the 0.4 EUR left at that rate, 0.36 USD
@pytest.mark.parametrize(
    "to_balance, to_base_balance, expected_to_balance, expected_to_base_balance",
    [
        (Decimal("0"), Decimal("0"), Decimal("1"), Decimal("0.91")),
        (Decimal("-0.6"), Decimal("-0.5"), Decimal("0.4"), Decimal("0.36")),
    ],
)
async def test_create_transfer_same_currency_credits_source_base_amount(
    db: AsyncSession,
    db_transaction: AsyncSession,
    to_balance: Decimal,
    to_base_balance: Decimal,
    expected_to_balance: Decimal,
    expected_to_base_balance: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("110"),
        "base_balance": Decimal("100"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Savings EUR",
        "currency": "EUR",
        "balance": to_balance,
        "base_balance": to_base_balance,
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)
    await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_db.id, kind=AccountKind.EQUITY, name="Adjustments"), commit=True
    )

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="EUR",
        destination_currency="EUR",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.create(data=transfer_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.postings[1].amount == Decimal("1")
    assert transaction.base_currency_amount == Decimal("0.91")

    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("109")
    assert account_from.base_balance == Decimal("99.09")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == expected_to_balance
    assert account_to.base_balance == expected_to_base_balance


@pytest.mark.parametrize("destination_amount", [Decimal("52"), Decimal("50")])
async def test_create_transfer_other_to_base_destination_amount_not_allowed(
    db: AsyncSession, db_transaction: AsyncSession, destination_amount: Decimal
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("110"),
        "base_balance": Decimal("100"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Wallet",
        "currency": "USD",
    }
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    # 55 of 110 EUR worth 100 USD is 50 USD
    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("55"),
        source_currency="EUR",
        destination_currency="USD",
        destination_amount=destination_amount,
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(DestinationAmountNotAllowed) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Destination amount not allowed"
    assert exc.value.log_message == (
        f"A destination_amount of {destination_amount} was sent for account `{account_to_db.id}`, "
        f"whose amount is derived from the source account's rate"
    )
    assert exc.value.error_code == ErrorCodeType.DESTINATION_AMOUNT_NOT_ALLOWED

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("110")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("0")


async def test_account_cache_equals_active_postings(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    wallet_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Wallet", currency="USD"
    )
    wallet_db: AccountModel = await account_crud.create(db=db, obj_in=wallet_create_data, commit=True)
    card_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.LIABILITY, user_id=user_db.id, name="Card EUR", currency="EUR"
    )
    card_db: AccountModel = await account_crud.create(db=db, obj_in=card_create_data, commit=True)
    category_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.EXPENSE, user_id=user_db.id, name="Food", category_type=CategoryType.VARIABLE
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)
    income_source_create_data: AccountCreate = AccountCreate(kind=AccountKind.INCOME, user_id=user_db.id, name="Salary")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    equity_create_data: AccountCreate = AccountCreate(kind=AccountKind.EQUITY, user_id=user_db.id, name="Adjustments")
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)
    location_create_data: LocationCreate = LocationCreate(user_id=user_db.id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    # each step commits through the plain session before the next one reads the cache it left
    requests: list[tuple[TransactionType, MovementRequest | AdjustmentCreate]] = [
        (
            TransactionType.INCOME,
            MovementRequest(
                transaction_date=date(2025, 2, 1),
                income_period=date(2025, 2, 1),
                source_amount=Decimal("1000"),
                source_currency="USD",
                destination_amount=Decimal("1000"),
                destination_currency="USD",
                from_account_id=income_source_db.id,
                to_account_id=wallet_db.id,
            ),
        ),
        (
            TransactionType.INCOME,
            MovementRequest(
                transaction_date=date(2025, 2, 2),
                income_period=date(2025, 2, 1),
                source_amount=Decimal("500"),
                source_currency="EUR",
                destination_amount=Decimal("500"),
                destination_currency="EUR",
                base_currency_amount=Decimal("550"),
                from_account_id=income_source_db.id,
                to_account_id=card_db.id,
            ),
        ),
        (
            TransactionType.EXPENSE,
            MovementRequest(
                transaction_date=date(2025, 2, 3),
                source_amount=Decimal("30"),
                source_currency="EUR",
                destination_amount=Decimal("30"),
                destination_currency="EUR",
                from_account_id=card_db.id,
                to_account_id=category_db.id,
                location_id=location_db.id,
            ),
        ),
        (
            TransactionType.TRANSFER,
            MovementRequest(
                transaction_date=date(2025, 2, 4),
                source_amount=Decimal("100"),
                source_currency="USD",
                destination_amount=Decimal("90"),
                destination_currency="EUR",
                from_account_id=wallet_db.id,
                to_account_id=card_db.id,
            ),
        ),
        (
            TransactionType.TRANSFER,
            MovementRequest(
                transaction_date=date(2025, 2, 5),
                source_amount=Decimal("50"),
                source_currency="EUR",
                destination_currency="USD",
                from_account_id=card_db.id,
                to_account_id=wallet_db.id,
            ),
        ),
        (
            TransactionType.ADJUSTMENT,
            AdjustmentCreate(transaction_date=date(2025, 2, 6), account_id=card_db.id, new_balance=Decimal("400")),
        ),
    ]
    transactions_before: list[Transaction] = []
    for transaction_type, request in requests:
        transaction_processor: TransactionProcessor = factory.get_processor(
            db=db, user_id=user_db.id, transaction_type=transaction_type
        )
        transactions_before.append(await transaction_processor.create(data=request))
        await db.commit()

    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.EXPENSE
    )
    await transaction_processor.delete(transaction_id=transactions_before[2].id)
    await db_transaction.commit()

    # Assert
    active_postings_query: Select = (
        select(PostingModel.account_id, func.sum(PostingModel.amount), func.sum(PostingModel.base_amount))
        .join(TransactionModel, TransactionModel.id == PostingModel.transaction_id)
        .where(TransactionModel.user_id == user_db.id, TransactionModel.status == EntityStatusType.ACTIVE)
        .group_by(PostingModel.account_id)
    )
    sums_by_account: dict[UUID, tuple[Decimal, Decimal]] = {
        account_id: (amount, base_amount)
        for account_id, amount, base_amount in (await db.execute(active_postings_query)).all()
    }

    money_accounts_query: Select = select(AccountModel).where(
        AccountModel.user_id == user_db.id, AccountModel.kind.in_(MONEY_ACCOUNT_KINDS)
    )
    money_accounts: list[AccountModel] = (await db.scalars(money_accounts_query)).all()
    assert len(money_accounts) == 2
    for account in money_accounts:
        assert (account.balance, account.base_balance) == sums_by_account[account.id]

    # the adjustment set the card to 400 EUR after the expense, so deleting the 30 EUR expense leaves 430
    card_after: AccountModel = await account_crud.get(db=db, id=card_db.id)
    assert card_after.balance == Decimal("430")

    transaction_sums_query: Select = (
        select(func.sum(PostingModel.base_amount))
        .join(TransactionModel, TransactionModel.id == PostingModel.transaction_id)
        .where(TransactionModel.user_id == user_db.id, TransactionModel.status == EntityStatusType.ACTIVE)
        .group_by(PostingModel.transaction_id)
    )
    transaction_base_sums: list[Decimal] = (await db.scalars(transaction_sums_query)).all()
    assert len(transaction_base_sums) == 5
    assert set(transaction_base_sums) == {Decimal("0")}


@pytest.mark.parametrize(
    "location_id_is_sent, income_period, expected_message, expected_log_message",
    [
        (True, None, "Field location_id not allowed", "Transaction type TRANSFER does not take location_id"),
        (
            False,
            date(2025, 2, 1),
            "Field income_period not allowed",
            "Transaction type TRANSFER does not take income_period",
        ),
    ],
)
async def test_create_transfer_field_not_allowed(
    db: AsyncSession,
    db_transaction: AsyncSession,
    location_id_is_sent: bool,
    income_period: date | None,
    expected_message: str,
    expected_log_message: str,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Checking USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Savings USD", currency="USD"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_db.id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
        location_id=location_db.id if location_id_is_sent else None,
        income_period=income_period,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(FieldNotAllowed) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == expected_message
    assert exc.value.log_message == expected_log_message
    assert exc.value.error_code == ErrorCodeType.FIELD_NOT_ALLOWED

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("100")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("0")


async def test_create_transfer_base_currency_amount_not_allowed(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("110"),
        "base_balance": Decimal("100"),
    }
    account_from_db: AccountModel = await account_crud.create(db=db, obj_in=account_from_create_data, commit=True)

    account_to_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_db.id, name="Savings EUR", currency="EUR"
    )
    account_to_db: AccountModel = await account_crud.create(db=db, obj_in=account_to_create_data, commit=True)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("55"),
        source_currency="EUR",
        destination_currency="EUR",
        base_currency_amount=Decimal("50"),
        from_account_id=account_from_db.id,
        to_account_id=account_to_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(BaseCurrencyAmountNotAllowed) as exc:
        await transaction_processor.create(data=transfer_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Base currency amount not allowed"
    assert exc.value.log_message == (
        f"A base_currency_amount of 50 was sent for account `{account_from_db.id}`, "
        f"whose base currency amount is derived"
    )
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_from: AccountModel = await account_crud.get(db=db, id=account_from_db.id)
    assert account_from.balance == Decimal("110")
    account_to: AccountModel = await account_crud.get(db=db, id=account_to_db.id)
    assert account_to.balance == Decimal("0")


async def test_update_transfer_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    from_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Checking USD",
            "currency": "USD",
            "balance": Decimal("500"),
            "base_balance": Decimal("500"),
        },
        commit=True,
    )
    old_to_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={"kind": AccountKind.ASSET, "user_id": user_id, "name": "Cash USD", "currency": "USD"},
        commit=True,
    )
    new_to_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={"kind": AccountKind.LIABILITY, "user_id": user_id, "name": "Credit card", "currency": "USD"},
        commit=True,
    )

    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.TRANSFER
    )
    transaction_before: Transaction = await transaction_processor.create(
        data=MovementRequest(
            transaction_date=date(2025, 2, 10),
            source_amount=Decimal("100"),
            source_currency="USD",
            destination_currency="USD",
            from_account_id=from_account_db.id,
            to_account_id=old_to_account_db.id,
        )
    )
    await db.commit()
    await db.close()

    update_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 12),
        comment="Card repayment",
        source_amount=Decimal("150"),
        source_currency="USD",
        destination_currency="USD",
        from_account_id=from_account_db.id,
        to_account_id=new_to_account_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.update(
        transaction_id=transaction_before.id, data=update_data
    )
    await db_transaction.commit()

    # Assert
    assert transaction.id == transaction_before.id
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == date(2025, 2, 12)
    assert transaction.comment == "Card repayment"
    assert transaction.base_currency_amount == Decimal("150")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (from_account_db.id, Decimal("-150"), "USD", Decimal("-150")),
        (new_to_account_db.id, Decimal("150"), "USD", Decimal("150")),
    ]

    balances: list[tuple] = (
        await db.execute(
            select(AccountModel.id, AccountModel.balance, AccountModel.base_balance).where(
                AccountModel.user_id == user_id
            )
        )
    ).all()
    assert sorted(balances) == sorted(
        [
            (from_account_db.id, Decimal("350"), Decimal("350")),
            (old_to_account_db.id, Decimal("0"), Decimal("0")),
            (new_to_account_db.id, Decimal("150"), Decimal("150")),
        ]
    )


async def test_update_transfer_onto_day_of_later_income_values_it_after_the_income(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    # An income of 100 EUR worth 110 USD, a transfer of 50 EUR, an expense of 100 EUR and,
    # created after the transfer, an income of 100 EUR worth 300 USD on 2025-03-10
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Cash EUR",
            "currency": "EUR",
            "balance": Decimal("50"),
            "base_balance": Decimal("245"),
        },
        commit=True,
    )
    to_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Savings EUR",
            "currency": "EUR",
            "balance": Decimal("50"),
            "base_balance": Decimal("55"),
        },
        commit=True,
    )
    income_source_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Salary"), commit=True
    )
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=user_id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
        ),
        commit=True,
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 2, 1),
            base_currency_amount=Decimal("110"),
            income_period=date(2025, 2, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-110")
            ),
            PostingCreate(account_id=account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("110")),
        ],
    )
    transfer_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.TRANSFER,
            transaction_date=date(2025, 2, 10),
            base_currency_amount=Decimal("55"),
        ),
        postings=[
            PostingCreate(account_id=account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-55")),
            PostingCreate(account_id=to_account_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("55")),
        ],
    )
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2025, 2, 15),
            base_currency_amount=Decimal("110"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=account_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-110")
            ),
            PostingCreate(account_id=category_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("110")),
        ],
    )
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 3, 10),
            base_currency_amount=Decimal("300"),
            income_period=date(2025, 3, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-300")
            ),
            PostingCreate(account_id=account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("300")),
        ],
    )
    await db.commit()

    update_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 3, 10),
        source_amount=Decimal("50"),
        source_currency="EUR",
        destination_currency="EUR",
        from_account_id=account_db.id,
        to_account_id=to_account_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.TRANSFER
    )
    transaction: Transaction = await transaction_processor.update(transaction_id=transfer_db.id, data=update_data)
    await db_transaction.commit()

    # Assert
    # The edited transfer goes to the end of 2025-03-10, after the income that gives the emptied account a rate of 3
    assert transaction.id == transfer_db.id
    assert transaction.base_currency_amount == Decimal("150")

    entry_orders: list[tuple] = (
        await db.execute(
            select(TransactionModel.id)
            .where(TransactionModel.transaction_date == date(2025, 3, 10))
            .order_by(TransactionModel.entry_order)
        )
    ).all()
    assert entry_orders[-1] == (transfer_db.id,)

    balances: list[tuple] = (
        await db.execute(
            select(AccountModel.id, AccountModel.balance, AccountModel.base_balance).where(
                AccountModel.id.in_([account_db.id, to_account_db.id])
            )
        )
    ).all()
    assert sorted(balances) == sorted(
        [(account_db.id, Decimal("50"), Decimal("150")), (to_account_db.id, Decimal("50"), Decimal("150"))]
    )


async def test_update_transfer_reversed_returns_expense_it_valued_to_waiting(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    # An expense of 50 EUR on an empty account, valued at 60 USD by a later transfer into it of 100 EUR worth 120 USD
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Cash EUR",
            "currency": "EUR",
            "balance": Decimal("50"),
            "base_balance": Decimal("60"),
        },
        commit=True,
    )
    other_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={"kind": AccountKind.ASSET, "user_id": user_id, "name": "Savings EUR", "currency": "EUR"},
        commit=True,
    )
    income_source_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Salary"), commit=True
    )
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=user_id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
        ),
        commit=True,
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 2, 1),
            base_currency_amount=Decimal("120"),
            income_period=date(2025, 2, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-120")
            ),
            PostingCreate(
                account_id=other_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("120")
            ),
        ],
    )
    expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2025, 3, 1),
            base_currency_amount=Decimal("60"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(account_id=account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-60")),
            PostingCreate(account_id=category_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("60")),
        ],
    )
    transfer_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.TRANSFER,
            transaction_date=date(2025, 3, 5),
            base_currency_amount=Decimal("120"),
        ),
        postings=[
            PostingCreate(
                account_id=other_account_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-120")
            ),
            PostingCreate(account_id=account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("120")),
        ],
    )
    await transaction_crud.update_valued_dates(db=db, valued_dates={expense_db.id: date(2025, 3, 5)})
    await db.commit()

    update_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 3, 20),
        source_amount=Decimal("50"),
        source_currency="EUR",
        destination_currency="EUR",
        from_account_id=account_db.id,
        to_account_id=other_account_db.id,
    )

    # Act / Assert
    # Without the transfer into it the expense waits again, so the account has no rate left on 2025-03-20
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.TRANSFER
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.update(transaction_id=transfer_db.id, data=update_data)

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transfer_date: date = await db.scalar(
        select(TransactionModel.transaction_date).where(TransactionModel.id == transfer_db.id)
    )
    assert transfer_date == date(2025, 3, 5)
