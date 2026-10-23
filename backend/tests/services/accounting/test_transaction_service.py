from datetime import date, timedelta
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
from app.crud.user.user import user_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import MovementNotAllowed
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import (
    AccountCreate,
    AccountKind,
    AdjustmentCreate,
    AdjustmentRequest,
    CategoryType,
)
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import MovementRequest, Transaction, TransactionRequest, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting import transaction_service
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor


async def test_get_transactions(db: AsyncSession):
    # Arrange
    base_date: date = date.today() - timedelta(days=30)
    user_create_data: UserCreate = UserCreate(
        username="test 1", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    wrong_user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": wrong_user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("104.98"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_source_create_data: AccountCreate = AccountCreate(
        user_id=wrong_user_db.id, kind=AccountKind.INCOME, name="Best Job"
    )
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    for i in range(1, 4):
        income_create_data: MovementRequest = MovementRequest(
            transaction_date=base_date + timedelta(days=10 + i),
            source_amount=Decimal("105") * i,
            source_currency="USD",
            destination_amount=Decimal("100"),
            destination_currency="EUR",
            to_account_id=account_db.id,
            from_account_id=income_source_db.id,
            income_period=date(2025, 1, 1),
        )
        transaction_processor: TransactionProcessor = factory.get_processor(
            db=db, user_id=wrong_user_db.id, transaction_type=TransactionType.INCOME
        )
        await transaction_processor.create(data=income_create_data)

    user_create_data: UserCreate = UserCreate(
        username="test 2", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Checking USD",
        "currency": "USD",
        "balance": Decimal("2000"),
        "base_balance": Decimal("2000"),
    }
    account_checking_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    for i in range(2):
        expense_create_data: MovementRequest = MovementRequest(
            transaction_date=base_date + timedelta(days=1),
            source_amount=Decimal("100"),
            source_currency="USD",
            destination_amount=Decimal("11100"),
            destination_currency="RSD",
            from_account_id=account_checking_db.id,
            to_account_id=category_db.id,
            location_id=location_db.id,
        )
        transaction_processor: TransactionProcessor = factory.get_processor(
            db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
        )
        transaction: Transaction = await transaction_processor.create(data=expense_create_data)
        if i == 1:
            transaction_processor: TransactionProcessor = factory.get_processor(
                db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
            )
            await transaction_processor.delete(transaction_id=transaction.id)

    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("104.98"),
    }
    account_income_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=2),
        source_amount=Decimal("1050"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="EUR",
        to_account_id=account_income_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    await transaction_processor.create(data=income_create_data)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=3),
        source_amount=Decimal("100"),
        source_currency="EUR",
        destination_currency="USD",
        from_account_id=account_income_db.id,
        to_account_id=account_checking_db.id,
        comment="test",
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=TransactionType.TRANSFER
    )
    await transaction_processor.create(data=transfer_create_data)
    await db.commit()
    await db.close()

    request_p1: TransactionRequest = TransactionRequest(page=1, size=2)
    request_p2: TransactionRequest = TransactionRequest(page=2, size=2)
    request_all: TransactionRequest = TransactionRequest(statuses=[])
    request_from_101: TransactionRequest = TransactionRequest(base_currency_amount_from=Decimal("101"))
    request_to_100: TransactionRequest = TransactionRequest(base_currency_amount_to=Decimal("100"))
    request_from_101_to_105: TransactionRequest = TransactionRequest(
        base_currency_amount_from=Decimal("101"), base_currency_amount_to=Decimal("105")
    )
    request_date_from: TransactionRequest = TransactionRequest(date_from=base_date + timedelta(days=2))
    request_date_to: TransactionRequest = TransactionRequest(date_to=base_date + timedelta(days=2))
    request_date_from_to: TransactionRequest = TransactionRequest(
        date_from=base_date + timedelta(days=3), date_to=base_date + timedelta(days=3)
    )
    request_transaction_type: TransactionRequest = TransactionRequest(transaction_types=[TransactionType.TRANSFER])
    request_amount_asc: TransactionRequest = TransactionRequest(orders=["base_currency_amount:asc"])

    # Act
    transactions_p1: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_p1, user_id=user_id
    )
    transactions_p2: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_p2, user_id=user_id
    )
    transactions_all: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_all, user_id=user_id
    )
    transactions_from_101: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_from_101, user_id=user_id
    )
    transactions_to_100: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_to_100, user_id=user_id
    )
    transactions_from_101_to_105: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_from_101_to_105, user_id=user_id
    )
    transactions_date_from: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_date_from, user_id=user_id
    )
    transactions_date_to: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_date_to, user_id=user_id
    )
    transactions_date_from_to: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_date_from_to, user_id=user_id
    )
    transactions_transaction_type: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_transaction_type, user_id=user_id
    )
    transactions_amount_asc: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_amount_asc, user_id=user_id
    )

    # Assert
    assert transactions_p1.total == 3
    assert len(transactions_p1.items) == 2
    assert transactions_p1.items[0].transaction_type == TransactionType.TRANSFER
    assert transactions_p1.items[1].transaction_type == TransactionType.INCOME

    assert transactions_p2.total == 3
    assert len(transactions_p2.items) == 1
    assert transactions_p2.items[0].transaction_type == TransactionType.EXPENSE

    assert transactions_all.total == 4
    assert len(transactions_all.items) == 4

    assert transactions_from_101.total == 2
    assert len(transactions_from_101.items) == 2
    for item in transactions_from_101.items:
        assert item.base_currency_amount >= Decimal("101")

    assert transactions_to_100.total == 1
    assert len(transactions_to_100.items) == 1
    assert transactions_to_100.items[0].base_currency_amount <= Decimal("100")

    assert transactions_from_101_to_105.total == 1
    assert len(transactions_from_101_to_105.items) == 1
    assert transactions_from_101_to_105.items[0].base_currency_amount >= Decimal("101")
    assert transactions_from_101_to_105.items[0].base_currency_amount <= Decimal("105")

    assert transactions_date_from.total == 2
    assert len(transactions_date_from.items) == 2
    for item in transactions_date_from.items:
        assert item.transaction_date >= base_date + timedelta(days=2)

    assert transactions_date_to.total == 2
    assert len(transactions_date_to.items) == 2
    for item in transactions_date_to.items:
        assert item.transaction_date <= base_date + timedelta(days=2)

    assert transactions_date_from_to.total == 1
    assert len(transactions_date_from_to.items) == 1
    assert transactions_date_from_to.items[0].transaction_date >= base_date + timedelta(days=3)
    assert transactions_date_from_to.items[0].transaction_date <= base_date + timedelta(days=3)

    assert transactions_transaction_type.total == 1
    assert len(transactions_transaction_type.items) == 1
    assert transactions_transaction_type.items[0].transaction_type == TransactionType.TRANSFER

    amounts_asc: list[Decimal] = [item.base_currency_amount for item in transactions_amount_asc.items]
    assert transactions_amount_asc.total == 3
    assert amounts_asc == sorted(amounts_asc)


async def test_get_transactions_by_accounts(db: AsyncSession):
    # Arrange
    base_date: date = date.today() - timedelta(days=30)
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
        "balance": Decimal("2000"),
        "base_balance": Decimal("2000"),
    }
    account_checking_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Income USD",
        "currency": "USD",
        "balance": Decimal("0"),
        "base_balance": Decimal("0"),
    }
    account_income_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Old income USD",
        "currency": "USD",
        "balance": Decimal("0"),
        "base_balance": Decimal("0"),
    }
    account_deleted_income_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Old checking USD",
        "currency": "USD",
        "balance": Decimal("0"),
        "base_balance": Decimal("0"),
    }
    account_deleted_checking_db: AccountModel = await account_crud.create(
        db=db, obj_in=account_create_data, commit=True
    )

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Food",
        category_type=CategoryType.VARIABLE,
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)
    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)
    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)

    # an expense from the checking account and an income to the income account,
    # then the two accounts deleted afterwards take every account role and end at a zero balance:
    # the old income account receives an income of 300 and transfers it out,
    # the old checking account receives a transfer of 500 and spends it
    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=1),
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
        from_account_id=account_checking_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    expense: Transaction = await transaction_processor.create(data=expense_create_data)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=2),
        source_amount=Decimal("1000"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="USD",
        to_account_id=account_income_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    income: Transaction = await transaction_processor.create(data=income_create_data)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=3),
        source_amount=Decimal("300"),
        source_currency="USD",
        destination_amount=Decimal("300"),
        destination_currency="USD",
        to_account_id=account_deleted_income_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    income_to_deleted: Transaction = await transaction_processor.create(data=income_create_data)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=4),
        source_amount=Decimal("300"),
        source_currency="USD",
        destination_currency="USD",
        destination_amount=Decimal("300"),
        from_account_id=account_deleted_income_db.id,
        to_account_id=account_checking_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.TRANSFER
    )
    transfer_from_deleted: Transaction = await transaction_processor.create(data=transfer_create_data)

    transfer_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=5),
        source_amount=Decimal("500"),
        source_currency="USD",
        destination_currency="USD",
        destination_amount=Decimal("500"),
        from_account_id=account_income_db.id,
        to_account_id=account_deleted_checking_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.TRANSFER
    )
    transfer_to_deleted: Transaction = await transaction_processor.create(data=transfer_create_data)

    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=6),
        source_amount=Decimal("500"),
        source_currency="USD",
        destination_amount=Decimal("500"),
        destination_currency="USD",
        from_account_id=account_deleted_checking_db.id,
        to_account_id=category_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    expense_from_deleted: Transaction = await transaction_processor.create(data=expense_create_data)

    # an expense from the active checking account to a category deleted afterwards,
    # which the filter of deleted accounts does not match, since a category holds no money
    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id,
        kind=AccountKind.EXPENSE,
        name="Old cafe",
        category_type=CategoryType.VARIABLE,
    )
    category_deleted_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data)
    expense_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=7),
        source_amount=Decimal("50"),
        source_currency="USD",
        destination_amount=Decimal("50"),
        destination_currency="USD",
        from_account_id=account_checking_db.id,
        to_account_id=category_deleted_db.id,
        location_id=location_db.id,
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    expense_to_deleted_category: Transaction = await transaction_processor.create(data=expense_create_data)
    await db.commit()

    for account_db in [account_deleted_income_db, account_deleted_checking_db, category_deleted_db]:
        await account_crud.update_orm(db=db, obj_in={"status": EntityStatusType.DELETED}, id=account_db.id, commit=True)
    await db.close()

    request_checking: TransactionRequest = TransactionRequest(account_ids=[account_checking_db.id])
    request_income: TransactionRequest = TransactionRequest(account_ids=[account_income_db.id])
    request_deleted: TransactionRequest = TransactionRequest(
        account_ids=[account_deleted_income_db.id, account_deleted_checking_db.id]
    )
    request_checking_and_deleted_income: TransactionRequest = TransactionRequest(
        account_ids=[account_checking_db.id, account_deleted_income_db.id]
    )
    request_deleted_only: TransactionRequest = TransactionRequest(is_deleted_accounts_only=True)
    request_checking_deleted_only: TransactionRequest = TransactionRequest(
        account_ids=[account_checking_db.id], is_deleted_accounts_only=True
    )
    request_income_deleted_only: TransactionRequest = TransactionRequest(
        account_ids=[account_income_db.id], is_deleted_accounts_only=True
    )
    request_no_account_filter: TransactionRequest = TransactionRequest()
    request_checking_and_category: TransactionRequest = TransactionRequest(
        account_ids=[account_checking_db.id, category_db.id]
    )
    request_checking_and_categories: TransactionRequest = TransactionRequest(
        account_ids=[account_checking_db.id, category_db.id, category_deleted_db.id]
    )
    request_income_source_and_income: TransactionRequest = TransactionRequest(
        account_ids=[income_source_db.id, account_income_db.id]
    )
    request_unknown_account: TransactionRequest = TransactionRequest(account_ids=[uuid4()])

    # Act
    transactions_checking: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_checking, user_id=user_id
    )
    transactions_income: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_income, user_id=user_id
    )
    transactions_deleted: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_deleted, user_id=user_id
    )
    transactions_checking_and_deleted_income: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_checking_and_deleted_income, user_id=user_id
    )
    transactions_deleted_only: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_deleted_only, user_id=user_id
    )
    transactions_checking_deleted_only: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_checking_deleted_only, user_id=user_id
    )
    transactions_income_deleted_only: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_income_deleted_only, user_id=user_id
    )
    transactions_no_account_filter: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_no_account_filter, user_id=user_id
    )
    transactions_checking_and_category: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_checking_and_category, user_id=user_id
    )
    transactions_checking_and_categories: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_checking_and_categories, user_id=user_id
    )
    transactions_income_source_and_income: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_income_source_and_income, user_id=user_id
    )
    transactions_unknown_account: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_unknown_account, user_id=user_id
    )

    # Assert
    # every list is ordered by transaction date, newest first
    deleted_account_transaction_ids: list[UUID] = [
        expense_from_deleted.id,
        transfer_to_deleted.id,
        transfer_from_deleted.id,
        income_to_deleted.id,
    ]
    assert [item.id for item in transactions_checking.items] == [
        expense_to_deleted_category.id,
        transfer_from_deleted.id,
        expense.id,
    ]
    assert [item.id for item in transactions_income.items] == [transfer_to_deleted.id, income.id]
    assert [item.id for item in transactions_deleted.items] == deleted_account_transaction_ids
    assert [item.id for item in transactions_checking_and_deleted_income.items] == [
        expense_to_deleted_category.id,
        transfer_from_deleted.id,
        income_to_deleted.id,
        expense.id,
    ]
    assert [item.id for item in transactions_deleted_only.items] == deleted_account_transaction_ids
    assert [item.id for item in transactions_checking_deleted_only.items] == [transfer_from_deleted.id]
    assert [item.id for item in transactions_income_deleted_only.items] == [transfer_to_deleted.id]
    assert [item.id for item in transactions_no_account_filter.items] == [
        expense_to_deleted_category.id,
        *deleted_account_transaction_ids,
        income.id,
        expense.id,
    ]
    # accounts of one kind match any of them, and kinds of accounts must all match
    assert [item.id for item in transactions_checking_and_category.items] == [expense.id]
    assert [item.id for item in transactions_checking_and_categories.items] == [
        expense_to_deleted_category.id,
        expense.id,
    ]
    assert [item.id for item in transactions_income_source_and_income.items] == [income.id]
    assert transactions_unknown_account.total == 0


async def test_get_transactions_whole_history_by_default(db: AsyncSession):
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
        "balance": Decimal("2000"),
        "base_balance": Decimal("2000"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)
    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    # one expense older than any default window and one of today
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.EXPENSE
    )
    for transaction_date in [date.today() - timedelta(days=400), date.today()]:
        expense_create_data: MovementRequest = MovementRequest(
            transaction_date=transaction_date,
            source_amount=Decimal("10"),
            source_currency="USD",
            destination_amount=Decimal("10"),
            destination_currency="USD",
            from_account_id=account_db.id,
            to_account_id=category_db.id,
            location_id=location_db.id,
        )
        await transaction_processor.create(data=expense_create_data)

    await db.commit()
    await db.close()

    # Act
    transactions: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=TransactionRequest(), user_id=user_id
    )

    # Assert
    assert [item.transaction_date for item in transactions.items] == [
        date.today(),
        date.today() - timedelta(days=400),
    ]


async def test_get_transactions_adjustments(db: AsyncSession):
    # Arrange
    base_date: date = date.today() - timedelta(days=30)
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_wallet_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_id,
        "name": "Card",
        "currency": "USD",
        "balance": Decimal("500"),
        "base_balance": Decimal("500"),
    }
    account_card_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_source_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Best Job")
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    equity_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments")
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    # an increase of the wallet and a decrease of the card, next to an income to the card
    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=base_date + timedelta(days=1), account_id=account_wallet_db.id, new_balance=Decimal("300")
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    wallet_increase: Transaction = await transaction_processor.create(data=adjustment_create_data)

    adjustment_create_data: AdjustmentCreate = AdjustmentCreate(
        transaction_date=base_date + timedelta(days=2), account_id=account_card_db.id, new_balance=Decimal("200")
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    card_decrease: Transaction = await transaction_processor.create(data=adjustment_create_data)

    income_create_data: MovementRequest = MovementRequest(
        transaction_date=base_date + timedelta(days=3),
        source_amount=Decimal("1000"),
        source_currency="USD",
        destination_amount=Decimal("1000"),
        destination_currency="USD",
        to_account_id=account_card_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.INCOME
    )
    income: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    request_wallet: TransactionRequest = TransactionRequest(account_ids=[account_wallet_db.id])
    request_card: TransactionRequest = TransactionRequest(account_ids=[account_card_db.id])
    request_adjustments: TransactionRequest = TransactionRequest(transaction_types=[TransactionType.ADJUSTMENT])

    # Act
    transactions_wallet: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_wallet, user_id=user_id
    )
    transactions_card: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_card, user_id=user_id
    )
    transactions_adjustments: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request_adjustments, user_id=user_id
    )

    # Assert
    assert [item.id for item in transactions_wallet.items] == [wallet_increase.id]
    assert transactions_wallet.items[0].postings[1].account.id == account_wallet_db.id
    assert [item.id for item in transactions_card.items] == [income.id, card_decrease.id]
    assert transactions_card.items[1].postings[0].account.id == account_card_db.id
    assert [item.id for item in transactions_adjustments.items] == [card_decrease.id, wallet_increase.id]


async def test_get_transaction_ok(db: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test 1", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("104.98"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_source_create_data: AccountCreate = AccountCreate(
        user_id=user_db.id, kind=AccountKind.INCOME, name="Best Job"
    )
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("105"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=TransactionType.INCOME
    )
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()

    # Act
    transaction: Transaction = await transaction_service.get_transaction(
        db=db, transaction_id=transaction_before.id, user_id=user_db.id
    )

    # Assert
    assert transaction.id == transaction_before.id


async def test_get_transaction_not_found(db: AsyncSession):
    # Arrange
    transaction_id: UUID = uuid4()
    user_id: UUID = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await transaction_service.get_transaction(db=db, transaction_id=transaction_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": transaction_id, "user_id": user_id}
    assert exc.value.log_message == f"{TransactionModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_get_transaction_not_found_wrong_user(db: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test 1", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    account_create_data: dict = {
        "kind": AccountKind.ASSET,
        "user_id": user_db.id,
        "name": "Income EUR",
        "currency": "EUR",
        "balance": Decimal("100"),
        "base_balance": Decimal("104.98"),
    }
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_source_create_data: AccountCreate = AccountCreate(
        user_id=user_db.id, kind=AccountKind.INCOME, name="Best Job"
    )
    income_source_db: AccountModel = await account_crud.create(db=db, obj_in=income_source_create_data, commit=True)
    income_create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("105"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="EUR",
        to_account_id=account_db.id,
        from_account_id=income_source_db.id,
        income_period=date(2025, 1, 1),
    )
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_db.id, transaction_type=TransactionType.INCOME
    )
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()

    wrong_user_id: UUID = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await transaction_service.get_transaction(db=db, transaction_id=transaction.id, user_id=wrong_user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": transaction.id, "user_id": wrong_user_id}
    assert exc.value.log_message == f"{TransactionModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.parametrize(
    "from_account_data, to_account_data, transaction_type, has_location, income_period",
    [
        (
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
            {"kind": AccountKind.EXPENSE, "name": "Food", "category_type": CategoryType.VARIABLE},
            TransactionType.EXPENSE,
            True,
            None,
        ),
        (
            {"kind": AccountKind.LIABILITY, "name": "Credit card USD", "currency": "USD"},
            {"kind": AccountKind.EXPENSE, "name": "Food", "category_type": CategoryType.VARIABLE},
            TransactionType.EXPENSE,
            True,
            None,
        ),
        (
            {"kind": AccountKind.INCOME, "name": "Best Job"},
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
            TransactionType.INCOME,
            False,
            date(2025, 2, 1),
        ),
        (
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
            {"kind": AccountKind.LIABILITY, "name": "Credit card USD", "currency": "USD"},
            TransactionType.TRANSFER,
            False,
            None,
        ),
    ],
)
async def test_create_transaction_type_from_account_kinds(
    db: AsyncSession,
    db_transaction: AsyncSession,
    from_account_data: dict,
    to_account_data: dict,
    transaction_type: TransactionType,
    has_location: bool,
    income_period: date | None,
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    from_account_db: AccountModel = await account_crud.create(
        db=db, obj_in={**from_account_data, "user_id": user_id}, commit=True
    )
    to_account_db: AccountModel = await account_crud.create(
        db=db, obj_in={**to_account_data, "user_id": user_id}, commit=True
    )
    location_create_data: LocationCreate = LocationCreate(user_id=user_id, name="Some shop")
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        from_account_id=from_account_db.id,
        to_account_id=to_account_db.id,
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
        location_id=location_db.id if has_location else None,
        income_period=income_period,
    )

    # Act
    transaction: Transaction = await transaction_service.create_transaction(
        db=db_transaction, create_data=create_data, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == transaction_type
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (from_account_db.id, Decimal("-100"), "USD", Decimal("-100")),
        (to_account_db.id, Decimal("100"), "USD", Decimal("100")),
    ]

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1
    assert transactions[0].transaction_type == transaction_type
    assert transactions[0].base_currency_amount == Decimal("100")

    postings: list[PostingModel] = (
        await db.scalars(
            select(PostingModel).where(PostingModel.transaction_id == transaction.id).order_by(PostingModel.amount)
        )
    ).all()
    assert [(posting.account_id, posting.amount, posting.currency, posting.base_amount) for posting in postings] == [
        (from_account_db.id, Decimal("-100"), "USD", Decimal("-100")),
        (to_account_db.id, Decimal("100"), "USD", Decimal("100")),
    ]


@pytest.mark.parametrize(
    "from_account_data, to_account_data",
    [
        (
            {"kind": AccountKind.EXPENSE, "name": "Food", "category_type": CategoryType.VARIABLE},
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
        ),
        (
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
            {"kind": AccountKind.INCOME, "name": "Best Job"},
        ),
        (
            {"kind": AccountKind.INCOME, "name": "Best Job"},
            {"kind": AccountKind.EXPENSE, "name": "Food", "category_type": CategoryType.VARIABLE},
        ),
        (
            {"kind": AccountKind.EQUITY, "name": "Adjustments"},
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
        ),
        (
            {"kind": AccountKind.ASSET, "name": "Checking USD", "currency": "USD"},
            {"kind": AccountKind.EQUITY, "name": "Adjustments"},
        ),
    ],
)
async def test_create_transaction_movement_not_allowed(
    db: AsyncSession, db_transaction: AsyncSession, from_account_data: dict, to_account_data: dict
):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    from_account_db: AccountModel = await account_crud.create(
        db=db, obj_in={**from_account_data, "user_id": user_id}, commit=True
    )
    to_account_db: AccountModel = await account_crud.create(
        db=db, obj_in={**to_account_data, "user_id": user_id}, commit=True
    )

    create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        from_account_id=from_account_db.id,
        to_account_id=to_account_db.id,
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
    )

    # Act / Assert
    with pytest.raises(MovementNotAllowed) as exc:
        await transaction_service.create_transaction(db=db_transaction, create_data=create_data, user_id=user_id)

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.error_code == ErrorCodeType.MOVEMENT_NOT_ALLOWED
    assert exc.value.log_message == (
        f"Money can not move from a {from_account_db.kind.value} account to a {to_account_db.kind.value} account"
    )

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


async def test_create_transaction_from_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    category_create_data: AccountCreate = AccountCreate(
        user_id=user_id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
    )
    category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    from_account_id: UUID = uuid4()
    create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        from_account_id=from_account_id,
        to_account_id=category_db.id,
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
    )

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await transaction_service.create_transaction(db=db_transaction, create_data=create_data, user_id=user_id)

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
    search_params = {"id": from_account_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"


async def test_create_transaction_to_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    to_account_id: UUID = uuid4()
    create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        from_account_id=account_db.id,
        to_account_id=to_account_id,
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
    )

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await transaction_service.create_transaction(db=db_transaction, create_data=create_data, user_id=user_id)

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
    search_params = {"id": to_account_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"


async def test_create_transaction_account_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test 1", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    other_user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    category_create_data: AccountCreate = AccountCreate(
        user_id=other_user_db.id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
    )
    other_category_db: AccountModel = await account_crud.create(db=db, obj_in=category_create_data, commit=True)

    user_create_data: UserCreate = UserCreate(
        username="test 2", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id
    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    create_data: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        from_account_id=account_db.id,
        to_account_id=other_category_db.id,
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
    )

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await transaction_service.create_transaction(db=db_transaction, create_data=create_data, user_id=user_id)

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
    search_params = {"id": other_category_db.id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0


async def test_adjust_balance_increase_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    equity_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments")
    equity_db: AccountModel = await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    adjustment_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), new_balance=Decimal("300")
    )

    # Act
    transaction: Transaction = await transaction_service.adjust_balance(
        db=db_transaction, account_id=account_db.id, adjustment_data=adjustment_data, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.base_currency_amount == Decimal("300")
    assert [
        (posting.account.id, posting.amount, posting.currency, posting.base_amount) for posting in transaction.postings
    ] == [
        (equity_db.id, Decimal("-300"), "USD", Decimal("-300")),
        (account_db.id, Decimal("300"), "USD", Decimal("300")),
    ]

    postings: list[PostingModel] = (
        await db.scalars(
            select(PostingModel).where(PostingModel.transaction_id == transaction.id).order_by(PostingModel.amount)
        )
    ).all()
    assert [(posting.account_id, posting.amount, posting.currency, posting.base_amount) for posting in postings] == [
        (equity_db.id, Decimal("-300"), "USD", Decimal("-300")),
        (account_db.id, Decimal("300"), "USD", Decimal("300")),
    ]

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    await db.refresh(account_db_after)
    assert account_db_after.balance == Decimal("300")
    assert account_db_after.base_balance == Decimal("300")


async def test_adjust_balance_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD"
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id
    equity_create_data: AccountCreate = AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments")
    await account_crud.create(db=db, obj_in=equity_create_data, commit=True)

    account_id: UUID = uuid4()
    adjustment_data: AdjustmentRequest = AdjustmentRequest(
        transaction_date=date(2025, 2, 10), new_balance=Decimal("300")
    )

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await transaction_service.adjust_balance(
            db=db_transaction, account_id=account_id, adjustment_data=adjustment_data, user_id=user_id
        )

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
    search_params = {"id": account_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 0
