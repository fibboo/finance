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
from app.crud.accounting.location import location_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import (
    CurrencyMismatchException,
    DeletedAccountTransactionForbidden,
    NoAccountBaseCurrencyRate,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import (
    AccountKindMismatch,
    BaseCurrencyAmountNotAllowed,
    FieldNotAllowed,
    FieldRequired,
)
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import Account, AccountCreate, AccountCreateRequest, AccountKind, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import MovementRequest, Transaction, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import User as UserModel, UserCreate
from app.services.accounting import account_service
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor


async def test_create_expense_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction: Transaction = await transaction_processor.create(data=expense_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.EXPENSE
    assert transaction.transaction_date == expense_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.base_currency_amount == Decimal("1")
    assert transaction.income_period is None
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (account_db.id, Decimal("-1"), "USD", Decimal("-1")),
        (category_db.id, Decimal("111"), "RSD", Decimal("1")),
    ]
    assert transaction.postings[0].account.balance == Decimal("-1") != account_balance_before
    assert transaction.postings[0].account.base_currency_balance == Decimal("-1")
    assert transaction.postings[0].account.base_currency_rate == Decimal("1")
    assert transaction.postings[1].account.kind == AccountKind.EXPENSE
    assert transaction.location.id == location_db.id

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1
    assert transactions[0].location_id == location_db.id
    assert transactions[0].income_period is None

    postings: list[PostingModel] = (
        await db.scalars(
            select(PostingModel).where(PostingModel.transaction_id == transaction.id).order_by(PostingModel.amount)
        )
    ).all()
    assert [(posting.account_id, posting.amount, posting.currency, posting.base_amount) for posting in postings] == [
        (account_db.id, Decimal("-1"), "USD", Decimal("-1")),
        (category_db.id, Decimal("111"), "RSD", Decimal("1")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("-1")
    assert account_db_after.base_balance == Decimal("-1")
    assert account_db_after.base_balance == Decimal("-1")
    category_db_after: AccountModel = await account_crud.get(db=db, id=category_db.id)
    await db.refresh(category_db_after)
    assert category_db_after.balance == Decimal("0")
    assert category_db_after.base_balance == Decimal("0")


# 100 of 300 EUR worth 315.01 USD is 105.0033... USD, more than the two places an amount keeps,
# and 0.50 of 200 RSD worth 1.71 USD is 0.0042... USD, which rounds below a cent and is kept at 0.01
@pytest.mark.parametrize(
    "currency, balance, base_balance, amount, expected_base_currency_amount",
    [
        ("EUR", Decimal("300"), Decimal("315.01"), Decimal("100"), Decimal("105.00")),
        ("RSD", Decimal("200"), Decimal("1.71"), Decimal("0.50"), Decimal("0.01")),
    ],
)
async def test_create_expense_other_currency_rounds_base_amount(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    balance: Decimal,
    base_balance: Decimal,
    amount: Decimal,
    expected_base_currency_amount: Decimal,
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
        "name": f"Wallet {currency}",
        "currency": currency,
        "balance": balance,
        "base_balance": base_balance,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=amount,
        source_currency=currency,
        destination_amount=amount,
        destination_currency=currency,
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction: Transaction = await transaction_processor.create(data=expense_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == expected_base_currency_amount

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == balance - amount
    assert account_db_after.base_balance == base_balance - expected_base_currency_amount


async def test_create_expense_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    from_account_id: UUID = uuid4()
    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=from_account_id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    assert exc.value.log_message == f"Account not found by {{'id': UUID('{from_account_id}')}}"
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


async def test_create_expense_no_base_rate(db: AsyncSession, db_transaction: AsyncSession):
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
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="EUR",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == "Accounts has no base currency rate"
    assert exc.value.log_message == f"Account {account_db.id} has no base currency rate. Try to make first deposit"
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_create_expense_currency_mismatch(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="RSD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(CurrencyMismatchException) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == "Account and transaction currency mismatch"
    assert exc.value.log_message == (
        f"Transaction currency {expense_create_data.source_currency} differs "
        f"from account `{account_db.id}` currency {account_db.currency}"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.CURRENCY_MISMATCH

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_create_expense_unknown_destination_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Wallet",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="XXX",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.log_message == "Currency not found by {'code': 'XXX'}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("100")


async def test_create_expense_category_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
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

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: AccountCreate = AccountCreate(
        user_id=other_user_db.id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(AccountKindMismatch) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Account kind mismatch"
    assert exc.value.log_message == f"Account `{category_db.id}` is not an active account of kind EXPENSE"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_create_expense_deleted_category(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: dict = {
        "kind": AccountKind.EXPENSE,
        "user_id": user_id,
        "name": "Food",
        "category_type": CategoryType.VARIABLE,
        "status": EntityStatusType.DELETED,
    }
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(AccountKindMismatch) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Account kind mismatch"
    assert exc.value.log_message == f"Account `{category_db.id}` is not an active account of kind EXPENSE"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_create_expense_location_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
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

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=other_user_db.id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    assert (
        exc.value.log_message
        == f"Location not found by {{'id': UUID('{location_db.id}'), 'user_id': UUID('{user_id}')}}"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_create_expense_deleted_location(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_balance_before: Decimal = copy(account_db.base_balance)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: dict = {"user_id": user_id, "name": "Some shop", "status": EntityStatusType.DELETED}
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    assert (
        exc.value.log_message
        == f"Location not found by {{'id': UUID('{location_db.id}'), 'user_id': UUID('{user_id}')}}"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_balance == base_balance_before


async def test_delete_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction_before: Transaction = await transaction_processor.create(data=expense_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")

    postings: list[PostingModel] = (
        await db.scalars(select(PostingModel).where(PostingModel.transaction_id == transaction.id))
    ).all()
    assert len(postings) == 2


# a debit that empties the account takes its whole base balance and leaves both sums at zero
async def test_create_expense_emptying_account_takes_base_balance(db: AsyncSession, db_transaction: AsyncSession):
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
        "balance": Decimal("30"),
        "base_balance": Decimal("10.01"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("30"),
        source_currency="EUR",
        destination_amount=Decimal("30"),
        destination_currency="EUR",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction: Transaction = await transaction_processor.create(data=expense_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("10.01")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")


# the emptied account keeps no rate, so a further debit has nothing to be valued at
async def test_create_expense_from_emptied_account_no_base_rate(db: AsyncSession, db_transaction: AsyncSession):
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
        "balance": Decimal("30"),
        "base_balance": Decimal("33"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("30"),
        source_currency="EUR",
        destination_amount=Decimal("30"),
        destination_currency="EUR",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    await transaction_processor.create(data=expense_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("0")
    assert account_db_after.base_balance == Decimal("0")


async def test_create_expense_opposite_signs_no_base_rate(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    # a balance and a base value of opposite signs, which a deleted earlier income can leave, give no rate
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
        "balance": Decimal("90"),
        "base_balance": Decimal("-50"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("30"),
        source_currency="EUR",
        destination_amount=Decimal("30"),
        destination_currency="EUR",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("90")
    assert account_db_after.base_balance == Decimal("-50")


@pytest.mark.parametrize(
    "currency, balance, base_balance, amount",
    [
        ("USD", Decimal("100"), Decimal("100"), Decimal("50")),
        ("EUR", Decimal("110"), Decimal("100"), Decimal("55")),
    ],
)
async def test_delete_expense_restores_account_balances(
    db: AsyncSession,
    db_transaction: AsyncSession,
    currency: str,
    balance: Decimal,
    base_balance: Decimal,
    amount: Decimal,
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
        "name": f"Card {currency}",
        "currency": currency,
        "balance": balance,
        "base_balance": base_balance,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=amount,
        source_currency=currency,
        destination_amount=amount,
        destination_currency=currency,
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction_before: Transaction = await transaction_processor.create(data=expense_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_before.id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED
    assert transaction.postings[0].account.balance == balance

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == balance
    assert account_db_after.base_balance == base_balance


async def test_delete_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    transaction_id: UUID = uuid4()
    user_id: UUID = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        transaction_processor: TransactionProcessor = factory.get_processor(
            db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
        )
        await transaction_processor.delete(transaction_id=transaction_id)
        await db_transaction.commit()
        await db_transaction.close()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    assert (
        exc.value.log_message
        == f"Transaction not found by {{'id': UUID('{transaction_id}'), 'user_id': UUID('{user_id}')}}"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


async def test_create_expense_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
        "status": EntityStatusType.DELETED,
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == "Transactions of a deleted account are forbidden"
    assert exc.value.log_message == (
        f"Account `{account_db.id}` is deleted. Restore it to create or delete its transactions"
    )
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("0")


async def test_delete_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("111"),
        destination_currency="RSD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction_before: Transaction = await transaction_processor.create(data=expense_create_data)
    await db.commit()

    await account_crud.update_orm(
        db=db, id=account_db.id, obj_in={"status": EntityStatusType.DELETED.value}, commit=True
    )
    await db.close()

    # Act / Assert
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
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
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("-1")
    assert account_db_after.base_balance == Decimal("-1")


async def test_create_expense_concurrent_keeps_both_balance_changes(
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
        "name": "Checking USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="USD",
        destination_amount=Decimal("10"),
        destination_currency="USD",
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    first_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    second_processor: TransactionProcessor = factory.get_processor(
        db=other_db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    waiting_on_lock_query: TextClause = text(
        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'"
    )

    # Act
    await first_processor.create(data=expense_create_data)
    second_create: asyncio.Task = asyncio.create_task(second_processor.create(data=expense_create_data))

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
    assert account_after.balance == Decimal("80")
    assert account_after.base_balance == Decimal("80")

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 2


async def test_create_expense_new_base_currency_account_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="Cash", currency="USD"
    )
    account: Account = await account_service.create_account(db=db, create_data=account_create_data, user_id=user_id)
    await db.commit()

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="USD",
        destination_amount=Decimal("10"),
        destination_currency="USD",
        from_account_id=account.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    transaction: Transaction = await transaction_processor.create(data=expense_create_data)
    await db_transaction.commit()

    # Assert
    assert transaction.base_currency_amount == Decimal("10")

    account_db_after: AccountModel = await account_crud.get(db=db, id=account.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("-10")
    assert account_db_after.base_balance == Decimal("-10")


async def test_create_expense_from_income_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    income_account_create_data: dict = {"kind": AccountKind.INCOME, "user_id": user_id, "name": "Salary"}
    income_account_db: AccountModel = await account_crud.create(db=db, obj_in=income_account_create_data, commit=True)
    category_create_data: dict = {
        "kind": AccountKind.EXPENSE,
        "user_id": user_id,
        "name": "Food",
        "category_type": CategoryType.VARIABLE,
    }
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        from_account_id=income_account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(AccountKindMismatch) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert (
        exc.value.log_message == f"Account `{income_account_db.id}` is not an active account of kind ASSET, LIABILITY"
    )
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


async def test_create_expense_category_of_other_kind(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_account_create_data: dict = {"kind": AccountKind.INCOME, "user_id": user_id, "name": "Salary"}
    income_account_db: AccountModel = await account_crud.create(db=db, obj_in=income_account_create_data, commit=True)
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("1"),
        source_currency="USD",
        destination_amount=Decimal("1"),
        destination_currency="USD",
        from_account_id=account_db.id,
        to_account_id=income_account_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(AccountKindMismatch) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.log_message == f"Account `{income_account_db.id}` is not an active account of kind EXPENSE"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("0")


@pytest.mark.parametrize(
    "request_fields, expected_exception, expected_message, expected_error_code, log_message",
    [
        (
            {"location_id": None},
            FieldRequired,
            "Field location_id required",
            ErrorCodeType.FIELD_REQUIRED,
            "Transaction type EXPENSE needs location_id",
        ),
        (
            {"destination_amount": None},
            FieldRequired,
            "Field destination_amount required",
            ErrorCodeType.FIELD_REQUIRED,
            "Transaction type EXPENSE needs destination_amount",
        ),
        (
            {"income_period": date(2025, 2, 1)},
            FieldNotAllowed,
            "Field income_period not allowed",
            ErrorCodeType.FIELD_NOT_ALLOWED,
            "Transaction type EXPENSE does not take income_period",
        ),
    ],
)
async def test_create_expense_field_not_allowed_for_type(
    db: AsyncSession,
    db_transaction: AsyncSession,
    request_fields: dict,
    expected_exception: type[FieldRequired | FieldNotAllowed],
    expected_message: str,
    expected_error_code: ErrorCodeType,
    log_message: str,
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
        "name": "Checking USD",
        "currency": "USD",
        "balance": Decimal("100"),
        "base_balance": Decimal("100"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        **{
            "transaction_date": date(2025, 2, 10),
            "source_amount": Decimal("1"),
            "source_currency": "USD",
            "destination_amount": Decimal("1"),
            "destination_currency": "USD",
            "from_account_id": account_db.id,
            "to_account_id": category_db.id,
            "location_id": location_db.id,
            **request_fields,
        }
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises((FieldRequired, FieldNotAllowed)) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert type(exc.value) is expected_exception
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == expected_message
    assert exc.value.log_message == log_message
    assert exc.value.error_code == expected_error_code

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("100")


async def test_create_expense_base_currency_amount_not_allowed(db: AsyncSession, db_transaction: AsyncSession):
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
        "balance": Decimal("100"),
        "base_balance": Decimal("110"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("10"),
        source_currency="EUR",
        destination_amount=Decimal("10"),
        destination_currency="EUR",
        base_currency_amount=Decimal("11"),
        from_account_id=account_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )

    # Act
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db_transaction, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    with pytest.raises(BaseCurrencyAmountNotAllowed) as exc:
        await transaction_processor.create(data=expense_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.message == "Base currency amount not allowed"
    assert exc.value.log_message == (
        f"A base_currency_amount of 11 was sent for account `{account_db.id}`, whose base currency amount is derived"
    )
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("100")
    assert account_db_after.base_balance == Decimal("110")
