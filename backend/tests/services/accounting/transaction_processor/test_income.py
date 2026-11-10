import asyncio
from copy import copy
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import (
    CurrencyMismatchException,
    DeletedAccountTransactionForbidden,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import (
    AccountKindMismatch,
    BaseCurrencyAmountNotAllowed,
    BaseCurrencyAmountRequired,
    FieldNotAllowed,
    FieldRequired,
)
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountCreate, AccountKind
from app.schemas.accounting.transaction import MovementRequest, Transaction, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor


async def test_create_income_base_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == income_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.base_currency_amount == Decimal("1")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (income_source_db.id, Decimal("-1"), "USD", Decimal("-1")),
        (account_db.id, Decimal("1"), "USD", Decimal("1")),
    ]
    assert transaction.postings[1].account.balance == Decimal("1") != account_balance_before
    assert transaction.postings[1].account.base_currency_rate == Decimal("1")
    assert transaction.postings[1].account.currency == income_create_data.destination_currency

    assert transaction.location is None
    assert transaction.income_period == date(2025, 1, 1)

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1

    postings: list[PostingModel] = (await db.scalars(select(PostingModel).order_by(PostingModel.amount))).all()
    assert [(p.account_id, p.amount, p.currency, p.base_amount) for p in postings] == [
        (income_source_db.id, Decimal("-1"), "USD", Decimal("-1")),
        (account_db.id, Decimal("1"), "USD", Decimal("1")),
    ]
    assert all(p.transaction_id == transaction.id for p in postings)

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1")
    assert account_db_after.base_balance == Decimal("1")
    assert account_db_after.base_balance == Decimal("1")


async def test_create_income_other_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income EUR", currency="EUR"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1050"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == income_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.base_currency_amount == Decimal("1050")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (income_source_db.id, Decimal("-1050"), "USD", Decimal("-1050")),
        (account_db.id, Decimal("1000"), "EUR", Decimal("1050")),
    ]
    assert transaction.postings[1].account.balance == Decimal("1000") != account_balance_before
    # the rate is derived from the cache: 1000 EUR over 1050 USD
    assert transaction.postings[1].account.base_currency_rate == Decimal("0.9523809524")
    assert transaction.postings[1].account.base_currency_balance == Decimal("1050.00")

    assert transaction.location is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1

    # the income source posts the payer's amount and currency, the account the credited one, both at 1050 USD
    postings: list[PostingModel] = (await db.scalars(select(PostingModel).order_by(PostingModel.amount))).all()
    assert [(p.account_id, p.amount, p.currency, p.base_amount) for p in postings] == [
        (income_source_db.id, Decimal("-1050"), "USD", Decimal("-1050")),
        (account_db.id, Decimal("1000"), "EUR", Decimal("1050")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1000")
    assert account_db_after.base_balance == Decimal("1050")


async def test_create_income_other_currency_2_transactions_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income EUR", currency="EUR"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data_1: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1050"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db,
        user_id=user_id,
        transaction_type=TransactionType.INCOME,
    )
    transaction_1: Transaction = await transaction_processor.create(data=income_create_data_1)
    account_balance_before: Decimal = copy(transaction_1.postings[1].account.balance)
    base_currency_rate_before: Decimal = copy(transaction_1.postings[1].account.base_currency_rate)
    await db.commit()
    await db.close()

    income_create_data_2: MovementRequest = MovementRequest(
        transaction_date=date(2025, 3, 10),
        source_amount=Decimal("1100"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 2, 1),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data_2)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == income_create_data_2.transaction_date
    assert transaction.comment is None
    assert transaction.base_currency_amount == Decimal("1100")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (income_source_db.id, Decimal("-1100"), "USD", Decimal("-1100")),
        (account_db.id, Decimal("1000"), "EUR", Decimal("1100")),
    ]
    assert transaction.postings[1].account.balance == Decimal("2000") != account_balance_before
    # 2000 EUR over 1050 + 1100 USD
    assert transaction.postings[1].account.base_currency_rate == Decimal("0.9302325581") != base_currency_rate_before

    assert transaction.location is None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 2

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("2000")
    assert account_db_after.base_balance == Decimal("2150")


async def test_create_income_strong_currency_against_weak_base_keeps_rate_digits(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="RSD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income EUR", currency="EUR"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    # 1000 EUR for 117000 RSD: 0.008547008547 EUR per RSD, which the derived rate keeps to 10 places
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("117000"),
        source_currency="RSD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.postings[1].account.balance == Decimal("1000")
    assert transaction.postings[1].account.base_currency_rate == Decimal("0.0085470085")


async def test_create_income_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    to_account_id: UUID = uuid4()
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=to_account_id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    assert exc.value.log_message == f"Account not found by {{'id': UUID('{to_account_id}')}}"
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0


async def test_create_income_currency_mismatch(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(CurrencyMismatchException) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == "Account and transaction currency mismatch"
    assert exc.value.log_message == (
        f"Transaction currency {income_create_data.destination_currency} differs "
        f"from account `{account_db.id}` currency {account_db.currency}"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.CURRENCY_MISMATCH

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_create_income_unknown_source_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Wallet", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="XXX",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.log_message == "Currency not found by {'code': 'XXX'}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_create_income_income_source_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    other_user_create_data: UserCreate = UserCreate(
        username="other", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    other_user_db: UserModel = await user_crud.create(db=db, obj_in=other_user_create_data, commit=True)

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    income_source_create_data: AccountCreate = AccountCreate(
        user_id=other_user_db.id, kind=AccountKind.INCOME, name="Best Job"
    )
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(AccountKindMismatch) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Account kind mismatch"
    assert exc.value.log_message == f"Account `{income_source_db.id}` is not an active account of kind INCOME"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_delete_base_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")


async def test_delete_other_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income EUR", currency="EUR"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1050"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")


async def test_delete_other_currency_2_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("104.98"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1050"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    # deleting subtracts the postings, so the cache returns exactly to its value before the income
    assert account_db_after.balance == Decimal("100") == account_balance_before
    assert account_db_after.base_balance == Decimal("104.98") == base_balance_before


async def test_create_income_into_negative_account_adds_its_base_amount(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Card EUR",
        "currency": "EUR",
        "balance": Decimal("-110"),
        "base_balance": Decimal("-100"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    # -110 EUR is worth -100 USD, so the income's own 100 USD brings the base balance to exactly 0
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("55"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.postings[1].account.id == account_db.id

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("-55")
    assert account_db_after.base_balance == Decimal("0")


async def test_create_income_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Income USD",
        "currency": "USD",
        "status": EntityStatusType.DELETED,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )
    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN
    assert exc.value.log_message == (
        f"Account `{account_db.id}` is deleted. Restore it to create or delete its transactions"
    )

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_delete_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()

    await account_crud.update_orm(
        db=db, id=account_db.id, obj_in={"status": EntityStatusType.DELETED.value}, commit=True
    )
    await db.close()

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.delete(transaction_id=transaction_before.id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN
    assert exc.value.log_message == (
        f"Account `{account_db.id}` is deleted. Restore it to create or delete its transactions"
    )

    transaction_db: TransactionModel = await db.scalar(
        select(TransactionModel).where(TransactionModel.id == transaction_before.id)
    )
    assert transaction_db.status == EntityStatusType.ACTIVE
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1")
    assert account_db_after.base_balance == Decimal("1")


async def test_create_income_concurrent_keeps_both_balance_changes(
    db: AsyncSession, db_transaction: AsyncSession, other_db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="USD",
        destination_amount=Decimal("10"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 18),
    )
    first_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    second_processor: TransactionProcessor = factory.get_processor(
        db=other_db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    waiting_on_lock_query: TextClause = text(
        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'"
    )

    # Act
    await first_processor.create(data=income_create_data)
    second_create: asyncio.Task = asyncio.create_task(second_processor.create(data=income_create_data))

    async with asyncio.timeout(5):
        while not second_create.done() and await db.scalar(waiting_on_lock_query) == 0:
            await db.execute(text("SELECT pg_stat_clear_snapshot()"))
            await asyncio.sleep(0.01)

    await db_transaction.commit()
    await second_create
    await other_db_transaction.commit()

    # Assert
    await db.commit()
    account_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_after)
    assert account_after.balance == Decimal("120")
    assert account_after.base_balance == Decimal("120")

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 2


async def test_create_income_other_source_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income EUR", currency="EUR"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1000"),
        source_currency="EUR",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
        base_currency_amount=Decimal("1080"),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("1080")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (income_source_db.id, Decimal("-1000"), "EUR", Decimal("-1080")),
        (account_db.id, Decimal("1000"), "EUR", Decimal("1080")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1000")
    assert account_db_after.base_balance == Decimal("1080")


async def test_create_income_other_source_currency_without_base_currency_amount(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income EUR", currency="EUR"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1000"),
        source_currency="EUR",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(BaseCurrencyAmountRequired) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Base currency amount required"
    assert exc.value.log_message == "An income in `EUR` needs a base_currency_amount: it is not the base currency"
    assert exc.value.log_level == LogLevelType.WARNING
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_AMOUNT_REQUIRED

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


# the base currency amount is derived whenever either currency is USD, so even the derived value is refused
@pytest.mark.parametrize(
    "source_amount, source_currency, destination_amount, destination_currency, base_currency_amount",
    [
        (Decimal("1000"), "USD", Decimal("1000"), "USD", Decimal("900")),
        (Decimal("1000"), "USD", Decimal("1000"), "USD", Decimal("1000")),
        (Decimal("1000"), "EUR", Decimal("1080"), "USD", Decimal("1080")),
        (Decimal("1000"), "USD", Decimal("950"), "EUR", Decimal("1000")),
    ],
)
async def test_create_income_base_currency_amount_not_allowed(
    db: AsyncSession,
    db_transaction: AsyncSession,
    source_amount: Decimal,
    source_currency: str,
    destination_amount: Decimal,
    destination_currency: str,
    base_currency_amount: Decimal,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET,
        user_id=user_id,
        name="Income",
        currency=destination_currency,
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=source_amount,
        source_currency=source_currency,
        destination_amount=destination_amount,
        destination_currency=destination_currency,
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
        base_currency_amount=base_currency_amount,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises(BaseCurrencyAmountNotAllowed) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Base currency amount not allowed"
    assert exc.value.log_message == (
        f"A base_currency_amount of {base_currency_amount} was sent for account `{account_db.id}`, "
        f"whose base currency amount is derived"
    )
    assert exc.value.log_level == LogLevelType.WARNING
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_create_income_into_base_currency_account_takes_credited_amount(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1000"),
        source_currency="EUR",
        destination_amount=Decimal("1080"),
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("1080")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("1080")
    assert account_db_after.base_balance == Decimal("1080")


@pytest.mark.parametrize(
    "destination_amount, income_period, has_location, expected_exception, expected_message, expected_error_code, "
    "expected_log_message",
    [
        (
            Decimal("1"),
            None,
            False,
            FieldRequired,
            "Field income_period required",
            ErrorCodeType.FIELD_REQUIRED,
            "Transaction type INCOME needs income_period",
        ),
        (
            None,
            date(2025, 1, 1),
            False,
            FieldRequired,
            "Field destination_amount required",
            ErrorCodeType.FIELD_REQUIRED,
            "Transaction type INCOME needs destination_amount",
        ),
        (
            Decimal("1"),
            date(2025, 1, 1),
            True,
            FieldNotAllowed,
            "Field location_id not allowed",
            ErrorCodeType.FIELD_NOT_ALLOWED,
            "Transaction type INCOME does not take location_id",
        ),
    ],
)
async def test_create_income_fields_by_type(
    db: AsyncSession,
    db_transaction: AsyncSession,
    destination_amount: Decimal | None,
    income_period: date | None,
    has_location: bool,
    expected_exception: type[FieldRequired | FieldNotAllowed],
    expected_message: str,
    expected_error_code: ErrorCodeType,
    expected_log_message: str,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(
        kind=AccountKind.ASSET, user_id=user_id, name="Income USD", currency="USD"
    )
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=destination_amount,
        destination_currency="USD",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=income_period,
        location_id=uuid4() if has_location else None,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    with pytest.raises((FieldRequired, FieldNotAllowed)) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert type(exc.value) is expected_exception
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == expected_message
    assert exc.value.log_message == expected_log_message
    assert exc.value.error_code == expected_error_code

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal("0")


async def test_update_income_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    old_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(kind=AccountKind.ASSET, user_id=user_id, name="Checking USD", currency="USD"),
        commit=True,
    )
    new_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(kind=AccountKind.ASSET, user_id=user_id, name="Cash EUR", currency="EUR"),
        commit=True,
    )
    old_income_source_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job"), commit=True
    )
    new_income_source_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Side Job"), commit=True
    )

    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction_before: Transaction = await transaction_processor.create(
        data=MovementRequest(
            transaction_date=date(2025, 2, 10),
            source_amount=Decimal("100"),
            source_currency="USD",
            destination_amount=Decimal("100"),
            destination_currency="USD",
            from_account_id=old_income_source_db.id,
            to_account_id=old_account_db.id,
            income_period=date(2025, 1, 1),
        )
    )
    await db.commit()
    await db.close()

    update_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 3, 5),
        source_amount=Decimal("90"),
        source_currency="EUR",
        destination_amount=Decimal("90"),
        destination_currency="EUR",
        base_currency_amount=Decimal("99"),
        from_account_id=new_income_source_db.id,
        to_account_id=new_account_db.id,
        income_period=date(2025, 2, 20),
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.update(
        transaction_id=transaction_before.id, data=update_data
    )
    await db_transaction.commit()

    # Assert
    assert transaction.id == transaction_before.id
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == date(2025, 3, 5)
    assert transaction.income_period == date(2025, 2, 1)
    assert transaction.base_currency_amount == Decimal("99")
    assert transaction.location is None
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (new_income_source_db.id, Decimal("-90"), "EUR", Decimal("-99")),
        (new_account_db.id, Decimal("90"), "EUR", Decimal("99")),
    ]

    postings: list[PostingModel] = (await db.scalars(select(PostingModel).order_by(PostingModel.amount))).all()
    assert [(posting.transaction_id, posting.account_id, posting.amount) for posting in postings] == [
        (transaction.id, new_income_source_db.id, Decimal("-90")),
        (transaction.id, new_account_db.id, Decimal("90")),
    ]

    old_account_db_after: AccountModel = await account_crud.get(db=db, id=old_account_db.id)
    assert (old_account_db_after.balance, old_account_db_after.base_balance) == (Decimal("0"), Decimal("0"))
    new_account_db_after: AccountModel = await account_crud.get(db=db, id=new_account_db.id)
    assert (new_account_db_after.balance, new_account_db_after.base_balance) == (Decimal("90"), Decimal("99"))
