from datetime import date, datetime, timedelta, UTC
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
import time_machine
from fastapi_pagination import Page
from pytest_httpx import HTTPXMock
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import NameAlreadyExists
from app.exceptions.forbidden_403 import AccountDeletionForbidden, LastAccountDeletionForbidden
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountKindMismatch
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import (
    Account,
    AccountCreate,
    AccountCreateRequest,
    AccountKind,
    AccountRequest,
    AccountRestoreRequest,
    AccountUpdate,
    CategoryType,
)
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import EntityStatusType, ListOrderType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting import account_service


@pytest.mark.parametrize("currency", ["USD", "EUR"])
async def test_create_account_ok(db_transaction: AsyncSession, currency: str):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", description="test description", currency=currency
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
    assert account.color is None
    assert account.base_currency_rate == Decimal("0")
    assert account.base_currency_balance == Decimal("0.00")
    assert account.status == EntityStatusType.ACTIVE


async def test_create_account_with_color(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", currency="USD", color="#2E8C7A"
    )

    # Act
    account: Account = await account_service.create_account(db=db_transaction, user_id=user_id, create_data=create_data)
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
        kind=AccountKind.ASSET, name="test name", description="test description", currency="USD"
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # Act
    with pytest.raises(NameAlreadyExists) as exc:
        await account_service.create_account(db=db_transaction, create_data=create_data, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Name already exists"
    assert exc.value.log_message == f"User `{user_id}` already has an active Account with this name"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 1


async def test_create_account_name_existing_in_another_case(db: AsyncSession, db_transaction: AsyncSession):
    # arrange
    user_id: UUID = uuid4()
    existing_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Freelance", currency="USD")
    await account_service.create_account(db=db, user_id=user_id, create_data=existing_data)
    await db.commit()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="freelance", currency="USD")

    # act / assert
    with pytest.raises(NameAlreadyExists) as exc:
        await account_service.create_account(db=db_transaction, create_data=create_data, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS
    accounts_db: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert [account.name for account in accounts_db] == ["Freelance"]


async def test_get_accounts(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    # 25 accounts, more than the 10 the removed per-user limit allowed
    for i in range(25):
        create_data: AccountCreateRequest = AccountCreateRequest(
            kind=AccountKind.ASSET, name=f"Account {i:02}", currency="USD"
        )
        await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    deleted_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="Account deleted", currency="USD"
    )
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
        kind=AccountKind.ASSET, name="test name", description="test description", currency="USD"
    )
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # A balance in another currency worth 5298.51 in the base currency, a rate of 14200.00 / 5298.51 = 2.6799987166
    await account_crud.update_orm(
        db=db,
        obj_in={"balance": Decimal("14200.00"), "base_balance": Decimal("5298.51")},
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
    assert account.base_currency_rate == Decimal("2.6799987166")
    assert str(account.base_currency_balance) == "5298.51"
    assert account.status == account_created.status


@pytest.mark.parametrize(
    ("balance_date", "balance", "base_currency_balance", "base_currency_rate"),
    [
        (date(2026, 3, 9), Decimal("0"), Decimal("0.00"), Decimal("0")),
        (date(2026, 3, 10), Decimal("100"), Decimal("110.00"), Decimal("0.9090909091")),
        (date(2026, 3, 11), Decimal("300"), Decimal("360.00"), Decimal("0.8333333333")),
    ],
)
async def test_get_account_on_date(
    db: AsyncSession,
    balance_date: date,
    balance: Decimal,
    base_currency_balance: Decimal,
    base_currency_rate: Decimal,
):
    # Arrange
    user_id: UUID = uuid4()

    # the account holds 250 EUR worth 360 USD: 100 EUR for 110 USD received on the 10th, 200 EUR for 250 USD on the
    # 11th, and an expense of 50 EUR on the 10th still waiting for a value
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Savings EUR",
            "currency": "EUR",
            "balance": Decimal("250"),
            "base_balance": Decimal("360"),
        },
        commit=True,
    )
    source_db: AccountModel = await account_crud.create(
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
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )
    incomes: list[tuple[date, Decimal, Decimal]] = [
        (date(2026, 3, 10), Decimal("100"), Decimal("110")),
        (date(2026, 3, 11), Decimal("200"), Decimal("250")),
    ]
    for transaction_date, amount, base_amount in incomes:
        await transaction_crud.create_with_postings(
            db=db,
            obj_in=TransactionCreate(
                user_id=user_id,
                transaction_type=TransactionType.INCOME,
                transaction_date=transaction_date,
                base_currency_amount=base_amount,
                income_period=date(2026, 2, 1),
            ),
            postings=[
                PostingCreate(account_id=source_db.id, amount=-amount, currency="EUR", base_amount=-base_amount),
                PostingCreate(account_id=account_db.id, amount=amount, currency="EUR", base_amount=base_amount),
            ],
        )

    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 10),
            base_currency_amount=None,
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(account_id=account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=None),
            PostingCreate(account_id=category_db.id, amount=Decimal("50"), currency="EUR", base_amount=None),
        ],
    )
    await db.commit()

    # Act
    account: Account = await account_service.get_account(
        db=db, account_id=account_db.id, user_id=user_id, balance_date=balance_date
    )

    # Assert
    assert account.balance == balance
    assert account.base_currency_balance == base_currency_balance
    assert account.base_currency_rate == base_currency_rate
    assert account.estimated_base_balance is None


@pytest.mark.parametrize(
    ("balance_date", "excluded_transaction", "balance", "base_currency_balance", "base_currency_rate"),
    [
        (date(2026, 3, 9), "adjustment", Decimal("0"), Decimal("0.00"), Decimal("0")),
        (date(2026, 3, 10), "adjustment", Decimal("0"), Decimal("0.00"), Decimal("0")),
        (date(2026, 3, 11), "adjustment", Decimal("200"), Decimal("250.00"), Decimal("0.8")),
        (date(2026, 3, 10), "income", Decimal("100"), Decimal("110.00"), Decimal("0.9090909091")),
        (date(2026, 3, 11), "income", Decimal("100"), Decimal("110.00"), Decimal("0.9090909091")),
    ],
)
async def test_get_account_on_date_without_transaction(
    db: AsyncSession,
    balance_date: date,
    excluded_transaction: str,
    balance: Decimal,
    base_currency_balance: Decimal,
    base_currency_rate: Decimal,
):
    # Arrange
    user_id: UUID = uuid4()

    # the account holds 300 EUR worth 360 USD: an adjustment of 100 EUR for 110 USD on the 10th and an income of
    # 200 EUR for 250 USD on the 11th
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Savings EUR",
            "currency": "EUR",
            "balance": Decimal("300"),
            "base_balance": Decimal("360"),
        },
        commit=True,
    )
    equity_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments"), commit=True
    )
    source_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Salary"), commit=True
    )
    adjustment_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.ADJUSTMENT,
            transaction_date=date(2026, 3, 10),
            base_currency_amount=Decimal("110"),
        ),
        postings=[
            PostingCreate(account_id=equity_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-110")),
            PostingCreate(account_id=account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("110")),
        ],
    )
    income_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2026, 3, 11),
            base_currency_amount=Decimal("250"),
            income_period=date(2026, 2, 1),
        ),
        postings=[
            PostingCreate(account_id=source_db.id, amount=Decimal("-200"), currency="EUR", base_amount=Decimal("-250")),
            PostingCreate(account_id=account_db.id, amount=Decimal("200"), currency="EUR", base_amount=Decimal("250")),
        ],
    )
    await db.commit()
    transaction_ids: dict[str, UUID] = {"adjustment": adjustment_db.id, "income": income_db.id}

    # Act
    account: Account = await account_service.get_account(
        db=db,
        account_id=account_db.id,
        user_id=user_id,
        balance_date=balance_date,
        excluded_transaction_id=transaction_ids[excluded_transaction],
    )

    # Assert
    assert account.balance == balance
    assert account.base_currency_balance == base_currency_balance
    assert account.base_currency_rate == base_currency_rate
    assert account.estimated_base_balance is None


async def test_get_account_on_date_category(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    wallet_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Wallet",
            "currency": "USD",
            "balance": Decimal("-10"),
            "base_balance": Decimal("-10"),
        },
        commit=True,
    )
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=user_id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
        ),
        commit=True,
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )

    # a category caches no balance, so an expense dated after the date has nothing to be taken out of
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 11),
            base_currency_amount=Decimal("10"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(account_id=wallet_db.id, amount=Decimal("-10"), currency="USD", base_amount=Decimal("-10")),
            PostingCreate(account_id=category_db.id, amount=Decimal("10"), currency="USD", base_amount=Decimal("10")),
        ],
    )
    await db.commit()

    # Act
    account: Account = await account_service.get_account(
        db=db, account_id=category_db.id, user_id=user_id, balance_date=date(2026, 3, 10)
    )

    # Assert
    assert account.balance == Decimal("0")
    assert account.base_currency_balance == Decimal("0.00")
    assert account.base_currency_rate == Decimal("0")


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


@pytest.mark.parametrize(
    ("kind", "category_type"),
    [(AccountKind.EXPENSE, CategoryType.VARIABLE), (AccountKind.INCOME, None)],
)
@pytest.mark.parametrize("balance_date", [None, date(2026, 3, 10)])
async def test_get_account_deleted_category_or_income_source(
    db: AsyncSession, kind: AccountKind, category_type: CategoryType | None, balance_date: date | None
):
    # Arrange
    user_id: UUID = uuid4()
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": kind,
            "user_id": user_id,
            "name": "Cigarettes",
            "description": "Quit in March",
            "category_type": category_type,
            "status": EntityStatusType.DELETED,
        },
        commit=True,
    )

    # Act
    account: Account = await account_service.get_account(
        db=db, account_id=account_db.id, user_id=user_id, balance_date=balance_date
    )

    # Assert
    assert account.id == account_db.id
    assert account.kind == kind
    assert account.name == "Cigarettes"
    assert account.description == "Quit in March"
    assert account.category_type == category_type
    assert account.status == EntityStatusType.DELETED
    assert account.balance == Decimal("0")
    assert account.base_currency_balance == Decimal("0.00")
    assert account.base_currency_rate == Decimal("0")


@pytest.mark.parametrize(
    ("kind", "currency"),
    [(AccountKind.ASSET, "USD"), (AccountKind.LIABILITY, "USD"), (AccountKind.EQUITY, None)],
)
@pytest.mark.parametrize("balance_date", [None, date(2026, 3, 10)])
async def test_get_account_deleted_ledger_account(
    db: AsyncSession, kind: AccountKind, currency: str | None, balance_date: date | None
):
    # Arrange
    user_id: UUID = uuid4()
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": kind,
            "user_id": user_id,
            "name": "Old wallet",
            "currency": currency,
            "status": EntityStatusType.DELETED,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.get_account(db=db, account_id=account_db.id, user_id=user_id, balance_date=balance_date)

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    search_params = {"id": account_db.id, "user_id": user_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_get_account_deleted_category_of_another_user(db: AsyncSession):
    # Arrange
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.EXPENSE,
            "user_id": uuid4(),
            "name": "Cigarettes",
            "category_type": CategoryType.VARIABLE,
            "status": EntityStatusType.DELETED,
        },
        commit=True,
    )
    user_id: UUID = uuid4()

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.get_account(db=db, account_id=category_db.id, user_id=user_id)

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    search_params = {"id": category_db.id, "user_id": user_id}
    assert exc.value.log_message == f"{AccountModel.__name__} not found by {search_params}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_update_account_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="test name", description="test description", currency="USD"
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
    create_data_1: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 1", currency="USD")
    account_created_1: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data_1)

    create_data_2: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 2", currency="USD")
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data_2)
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Account 2")

    # Act
    with pytest.raises(NameAlreadyExists) as exc:
        await account_service.update_account(
            db=db_transaction, account_id=account_created_1.id, user_id=user_id, update_data=update_data
        )
        await db_transaction.commit()
        await db_transaction.close()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Name already exists"
    assert exc.value.log_message == f"User `{user_id}` already has an active Account with this name"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    transactions: list[AccountModel] = (await db.scalars(select(AccountModel))).all()
    assert len(transactions) == 2


async def test_create_account_name_of_deleted_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    # Wallet stays active, so the deleted account is not the last money account
    wallet_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="Wallet", currency="USD"
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=wallet_create_data)
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
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
    create_data_1: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 1", currency="USD")
    account_created_1: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data_1)

    create_data_2: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="Account 2", currency="USD")
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
    # Wallet stays active, so the deleted account is not the last money account
    wallet_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="Wallet", currency="USD"
    )
    wallet: Account = await account_service.create_account(db=db, user_id=user_id, create_data=wallet_create_data)
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=account_created.id, user_id=user_id)
    await db.commit()

    # Act
    account: Account = await account_service.restore_account(
        db=db_transaction, account_id=account_created.id, restore_data=None, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert account.id == account_created.id
    assert account.name == account_created.name
    assert account.balance == Decimal("0")
    assert account.status == EntityStatusType.ACTIVE

    request: AccountRequest = AccountRequest()
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_id)
    assert {account.id for account in accounts.items} == {wallet.id, account_created.id}


async def test_restore_account_not_found(db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_id: UUID = uuid4()

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.restore_account(
            db=db_transaction, account_id=account_id, restore_data=None, user_id=user_id
        )
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
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await account_service.restore_account(
            db=db_transaction, account_id=account_created.id, restore_data=None, user_id=user_id
        )
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account_created.id))
    assert account_db.status == EntityStatusType.ACTIVE


async def test_restore_account_name_taken(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    # Wallet stays active, so the deleted account is not the last money account
    wallet_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.ASSET, name="Wallet", currency="USD"
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=wallet_create_data)
    create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.ASSET, name="test name", currency="USD")
    deleted_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    # Act / Assert
    with pytest.raises(NameAlreadyExists) as exc:
        await account_service.restore_account(
            db=db_transaction, account_id=deleted_account.id, restore_data=None, user_id=user_id
        )
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Name already exists"
    assert exc.value.log_message == f"User `{user_id}` already has an active Account with this name"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == deleted_account.id))
    assert account_db.status == EntityStatusType.DELETED


async def test_restore_account_body_without_name_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.EXPENSE, name="Gym", category_type=CategoryType.FIXED
    )
    deleted_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    await db.commit()
    restore_data: AccountRestoreRequest = AccountRestoreRequest()

    # Act
    account: Account = await account_service.restore_account(
        db=db_transaction, account_id=deleted_account.id, restore_data=restore_data, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert account.id == deleted_account.id
    assert account.name == "Gym"
    assert account.status == EntityStatusType.ACTIVE


async def test_restore_account_new_name_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.EXPENSE, name="Gym", category_type=CategoryType.FIXED
    )
    deleted_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    # The active account holds the old name, so only the new name lets the deleted one back
    active_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()
    restore_data: AccountRestoreRequest = AccountRestoreRequest(name="Gym membership")

    # Act
    account: Account = await account_service.restore_account(
        db=db_transaction, account_id=deleted_account.id, restore_data=restore_data, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert account.id == deleted_account.id
    assert account.name == "Gym membership"
    assert account.status == EntityStatusType.ACTIVE

    request: AccountRequest = AccountRequest()
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_id)
    assert {(account.id, account.name) for account in accounts.items} == {
        (active_account.id, "Gym"),
        (deleted_account.id, "Gym membership"),
    }


async def test_restore_account_new_name_taken(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.EXPENSE, name="Gym", category_type=CategoryType.FIXED
    )
    deleted_account: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await account_service.delete_account(db=db, account_id=deleted_account.id, user_id=user_id)
    taken_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.EXPENSE, name="Gym membership", category_type=CategoryType.FIXED
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=taken_create_data)
    await db.commit()
    restore_data: AccountRestoreRequest = AccountRestoreRequest(name="Gym membership")

    # Act / Assert
    with pytest.raises(NameAlreadyExists) as exc:
        await account_service.restore_account(
            db=db_transaction, account_id=deleted_account.id, restore_data=restore_data, user_id=user_id
        )
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == deleted_account.id))
    assert account_db.status == EntityStatusType.DELETED
    assert account_db.name == "Gym"


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
    account: Account = await account_service.create_account(db=db_transaction, user_id=user_id, create_data=create_data)
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
    await account_service.create_account(db=db, user_id=user_id, create_data=asset_create_data)
    await db.commit()

    income_create_data: AccountCreateRequest = AccountCreateRequest(kind=AccountKind.INCOME, name="Job")

    # Act
    account: Account = await account_service.create_account(
        db=db_transaction, user_id=user_id, create_data=income_create_data
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
    await account_service.create_account(db=db, user_id=user_id, create_data=income_create_data)
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


async def test_get_accounts_category_types(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    await db.commit()

    default_request: AccountRequest = AccountRequest(size=100)
    fixed_request: AccountRequest = AccountRequest(category_types=[CategoryType.FIXED])
    fixed_and_periodic_request: AccountRequest = AccountRequest(
        category_types=[CategoryType.FIXED, CategoryType.PERIODIC]
    )

    # Act
    default_accounts: Page[Account] = await account_service.get_accounts(
        db=db, request=default_request, user_id=user_id
    )
    fixed_accounts: Page[Account] = await account_service.get_accounts(db=db, request=fixed_request, user_id=user_id)
    fixed_and_periodic_accounts: Page[Account] = await account_service.get_accounts(
        db=db, request=fixed_and_periodic_request, user_id=user_id
    )

    # Assert
    # Wallet and eight categories; the empty default filters nothing
    assert default_accounts.total == 9
    # Wallet has no category type and drops out
    assert [account.name for account in fixed_accounts.items] == ["Subscriptions", "Utilities"]
    assert [account.name for account in fixed_and_periodic_accounts.items] == [
        "Clothing",
        "Health",
        "Subscriptions",
        "Travel",
        "Utilities",
    ]


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


async def test_get_accounts_statuses(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    await db.commit()
    travel_db: AccountModel = await account_crud.get(db=db, user_id=user_id, name="Travel")
    transport_db: AccountModel = await account_crud.get(db=db, user_id=user_id, name="Transport")
    await account_service.delete_account(db=db, account_id=travel_db.id, user_id=user_id)
    await db.commit()

    deleted_request: AccountRequest = AccountRequest(statuses=[EntityStatusType.DELETED])
    all_request: AccountRequest = AccountRequest(
        statuses=[EntityStatusType.ACTIVE, EntityStatusType.DELETED], search_term="tra"
    )

    # Act
    deleted_accounts: Page[Account] = await account_service.get_accounts(
        db=db, request=deleted_request, user_id=user_id
    )
    all_accounts: Page[Account] = await account_service.get_accounts(db=db, request=all_request, user_id=user_id)

    # Assert
    assert [account.id for account in deleted_accounts.items] == [travel_db.id]
    assert deleted_accounts.items[0].status == EntityStatusType.DELETED
    # Transport is active and Travel is deleted; both match the search term
    assert [account.id for account in all_accounts.items] == [transport_db.id, travel_db.id]


async def test_update_account_color(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.LIABILITY, name="Credit card", currency="USD", color="#112233"
    )
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Credit card", color="#AABBCC")

    # Act
    account: Account = await account_service.update_account(
        db=db_transaction, account_id=account_created.id, user_id=user_id, update_data=update_data
    )
    await db_transaction.commit()

    # Assert
    assert account.color == "#AABBCC"

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account_created.id))
    assert account_db.color == "#AABBCC"


@pytest.mark.parametrize(
    "kind, category_type", [(AccountKind.EXPENSE, CategoryType.VARIABLE), (AccountKind.INCOME, None)]
)
async def test_update_account_color_kind_mismatch(
    db: AsyncSession, db_transaction: AsyncSession, kind: AccountKind, category_type: CategoryType | None
):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(kind=kind, name="Account", category_type=category_type)
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
    await db.commit()

    update_data: AccountUpdate = AccountUpdate(name="Updated", color="#AABBCC")

    # Act / Assert
    with pytest.raises(AccountKindMismatch) as exc:
        await account_service.update_account(
            db=db_transaction, account_id=account_created.id, user_id=user_id, update_data=update_data
        )
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.log_message == f"Account `{account_created.id}` is not an active account of kind ASSET, LIABILITY"
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_KIND_MISMATCH

    account_db: AccountModel = await db.scalar(select(AccountModel).where(AccountModel.id == account_created.id))
    assert account_db.name == "Account"
    assert account_db.color is None


async def test_update_account_category_type_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.EXPENSE, name="Netflix", category_type=CategoryType.VARIABLE
    )
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
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
    account_created: Account = await account_service.create_account(db=db, user_id=user_id, create_data=create_data)
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
        "base_balance": Decimal("-100.00"),
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


# a zero balance with a base value left over is written off to the EQUITY account by an adjustment
async def test_delete_account_writes_off_base_balance(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    card_create_data: dict = {
        "user_id": user_id,
        "kind": AccountKind.LIABILITY,
        "name": "Credit card",
        "currency": "EUR",
        "balance": Decimal("0"),
        "base_balance": Decimal("-10.00"),
    }
    card_db: AccountModel = await account_crud.create(db=db, obj_in=card_create_data, commit=True)
    await account_crud.create(
        db=db,
        obj_in={"user_id": user_id, "kind": AccountKind.ASSET, "name": "Wallet", "currency": "USD"},
        commit=True,
    )
    equity_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments"), commit=True
    )

    # Act
    account: Account = await account_service.delete_account(db=db_transaction, account_id=card_db.id, user_id=user_id)
    await db_transaction.commit()

    # Assert
    assert account.status == EntityStatusType.DELETED

    await db.refresh(card_db)
    assert card_db.balance == Decimal("0")
    assert card_db.base_balance == Decimal("0")

    write_off_db: TransactionModel = (
        await db.scalars(select(TransactionModel).where(TransactionModel.user_id == user_id))
    ).one()
    assert write_off_db.transaction_type == TransactionType.ADJUSTMENT
    assert write_off_db.base_currency_amount == Decimal("10.00")
    postings: list[tuple[UUID, Decimal, Decimal]] = sorted(
        (posting_db.account_id, posting_db.amount, posting_db.base_amount) for posting_db in write_off_db.postings
    )
    assert postings == sorted(
        [(card_db.id, Decimal("0"), Decimal("10.00")), (equity_db.id, Decimal("0"), Decimal("-10.00"))]
    )


async def test_delete_account_category_keeps_transactions(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    wallet_create_data: dict = {
        "user_id": user_id,
        "kind": AccountKind.ASSET,
        "name": "Wallet",
        "currency": "USD",
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
    expense_create_data: TransactionCreate = TransactionCreate(
        user_id=user_id,
        transaction_type=TransactionType.EXPENSE,
        transaction_date=date(2025, 2, 10),
        base_currency_amount=Decimal("10"),
        location_id=location_db.id,
    )
    postings_create_data: list[PostingCreate] = [
        PostingCreate(account_id=wallet_db.id, amount=Decimal("-10"), currency="USD", base_amount=Decimal("-10")),
        PostingCreate(account_id=category_db.id, amount=Decimal("10"), currency="USD", base_amount=Decimal("10")),
    ]
    expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db, obj_in=expense_create_data, postings=postings_create_data
    )
    await db.commit()

    # Act
    account: Account = await account_service.delete_account(
        db=db_transaction, account_id=category_db.id, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert account.id == category_db.id
    assert account.status == EntityStatusType.DELETED

    expense_after_db: TransactionModel = await db.scalar(
        select(TransactionModel).where(TransactionModel.id == expense_db.id).execution_options(populate_existing=True)
    )
    assert [posting_db.account_id for posting_db in expense_after_db.postings] == [wallet_db.id, category_db.id]
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


async def test_delete_account_last_money_account(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    card_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.LIABILITY, name="Credit card", currency="USD"
    )
    card: Account = await account_service.create_account(db=db, user_id=user_id, create_data=card_create_data)
    await db.commit()
    await account_service.delete_account(db=db, account_id=card.id, user_id=user_id)
    await db.commit()
    wallet_db: AccountModel = await account_crud.get(db=db, user_id=user_id, kind=AccountKind.ASSET)

    # Act / Assert
    with pytest.raises(LastAccountDeletionForbidden) as exc:
        await account_service.delete_account(db=db_transaction, account_id=wallet_db.id, user_id=user_id)
        await db_transaction.commit()

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == "The last money account cannot be deleted"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.LAST_ACCOUNT_DELETION_FORBIDDEN

    await db.refresh(wallet_db)
    assert wallet_db.status == EntityStatusType.ACTIVE


async def test_delete_account_other_money_account_active(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_service.create_default_accounts(db=db, user_id=user_id, base_currency="USD")
    card_create_data: AccountCreateRequest = AccountCreateRequest(
        kind=AccountKind.LIABILITY, name="Credit card", currency="USD"
    )
    await account_service.create_account(db=db, user_id=user_id, create_data=card_create_data)
    await db.commit()
    wallet_db: AccountModel = await account_crud.get(db=db, user_id=user_id, kind=AccountKind.ASSET)

    # Act
    account: Account = await account_service.delete_account(db=db_transaction, account_id=wallet_db.id, user_id=user_id)
    await db_transaction.commit()

    # Assert
    assert account.id == wallet_db.id
    assert account.status == EntityStatusType.DELETED


async def test_get_accounts_estimated_base_balance(db: AsyncSession, httpx_mock: HTTPXMock):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )

    # the card owes 100 EUR valued at 110 USD and 30 EUR more waiting for a value
    eur_card_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.LIABILITY,
            "user_id": user_db.id,
            "name": "Card EUR",
            "currency": "EUR",
            "balance": Decimal("-130"),
            "base_balance": Decimal("-110"),
        },
        commit=True,
    )
    usd_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_db.id,
            "name": "Checking",
            "currency": "USD",
            "balance": Decimal("80"),
            "base_balance": Decimal("80"),
        },
        commit=True,
    )
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=user_db.id, kind=AccountKind.EXPENSE, name="Food", category_type=CategoryType.VARIABLE
        ),
        commit=True,
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_db.id, name="Shop"), commit=True
    )
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_db.id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2026, 10, 3),
            base_currency_amount=None,
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(account_id=eur_card_db.id, amount=Decimal("-30"), currency="EUR", base_amount=None),
            PostingCreate(account_id=category_db.id, amount=Decimal("30"), currency="EUR", base_amount=None),
        ],
    )
    await db.commit()

    # 1 EUR is 1.25 USD
    httpx_mock.add_response(
        method="GET",
        url="https://open.er-api.test/v6/latest/USD",
        json={"result": "success", "base_code": "USD", "rates": {"USD": 1, "EUR": 0.8}},
    )
    request = AccountRequest(kinds=[AccountKind.ASSET, AccountKind.LIABILITY, AccountKind.EXPENSE])

    # Act
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_db.id)

    # Assert
    estimated_base_balances: dict[UUID, Decimal | None] = {
        account.id: account.estimated_base_balance for account in accounts.items
    }
    assert estimated_base_balances == {
        eur_card_db.id: Decimal("-147.50"),
        usd_account_db.id: None,
        category_db.id: None,
    }


@time_machine.travel(datetime(2026, 6, 15, 12, tzinfo=UTC), tick=False)
async def test_get_accounts_recent_use_order(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    today: date = date(2026, 6, 15)
    wallet_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={"user_id": user_id, "kind": AccountKind.ASSET, "name": "Wallet", "currency": "USD"},
        commit=True,
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Some shop"), commit=True
    )
    categories_db: dict[str, AccountModel] = {}
    for name in ["Alpha", "Bravo", "Charlie", "Delta"]:
        categories_db[name] = await account_crud.create(
            db=db,
            obj_in={
                "user_id": user_id,
                "kind": AccountKind.EXPENSE,
                "name": name,
                "category_type": CategoryType.VARIABLE,
            },
            commit=True,
        )

    # Delta is used three times dated tomorrow (still a local today east of UTC), Bravo twice and Alpha once within
    # the 90 days up to today, Alpha's expense carrying two zero exchange-difference postings that are no extra uses;
    # Charlie only two days ahead, twice 90 days ago and in deleted expenses
    expenses: list[tuple[str, date, EntityStatusType, int]] = [
        ("Delta", today + timedelta(days=1), EntityStatusType.ACTIVE, 0),
        ("Delta", today + timedelta(days=1), EntityStatusType.ACTIVE, 0),
        ("Delta", today + timedelta(days=1), EntityStatusType.ACTIVE, 0),
        ("Bravo", today - timedelta(days=1), EntityStatusType.ACTIVE, 0),
        ("Bravo", today - timedelta(days=89), EntityStatusType.ACTIVE, 0),
        ("Alpha", today, EntityStatusType.ACTIVE, 2),
        ("Charlie", today + timedelta(days=2), EntityStatusType.ACTIVE, 0),
        ("Charlie", today + timedelta(days=2), EntityStatusType.ACTIVE, 0),
        ("Charlie", today + timedelta(days=2), EntityStatusType.ACTIVE, 0),
        ("Charlie", today - timedelta(days=90), EntityStatusType.ACTIVE, 0),
        ("Charlie", today - timedelta(days=90), EntityStatusType.ACTIVE, 0),
        ("Charlie", today - timedelta(days=2), EntityStatusType.DELETED, 0),
        ("Charlie", today - timedelta(days=3), EntityStatusType.DELETED, 0),
    ]
    for category_name, transaction_date, transaction_status, exchange_difference_count in expenses:
        expense_db: TransactionModel = await transaction_crud.create_with_postings(
            db=db,
            obj_in=TransactionCreate(
                user_id=user_id,
                transaction_type=TransactionType.EXPENSE,
                transaction_date=transaction_date,
                base_currency_amount=Decimal("10"),
                location_id=location_db.id,
            ),
            postings=[
                PostingCreate(
                    account_id=wallet_db.id, amount=Decimal("-10"), currency="USD", base_amount=Decimal("-10")
                ),
                PostingCreate(
                    account_id=categories_db[category_name].id,
                    amount=Decimal("10"),
                    currency="USD",
                    base_amount=Decimal("10"),
                ),
            ]
            + [
                PostingCreate(
                    account_id=categories_db[category_name].id,
                    amount=Decimal("0"),
                    currency="USD",
                    base_amount=Decimal("0"),
                )
                for _ in range(exchange_difference_count)
            ],
        )
        await transaction_crud.update_orm(db=db, obj_in={"status": transaction_status}, id=expense_db.id)
    await db.commit()

    recent_use_request: AccountRequest = AccountRequest(kinds=[AccountKind.EXPENSE], order=ListOrderType.RECENT_USE)
    name_request: AccountRequest = AccountRequest(kinds=[AccountKind.EXPENSE])

    # Act
    by_recent_use: Page[Account] = await account_service.get_accounts(
        db=db, request=recent_use_request, user_id=user_id
    )
    by_name: Page[Account] = await account_service.get_accounts(db=db, request=name_request, user_id=user_id)

    # Assert
    assert [account.name for account in by_recent_use.items] == ["Delta", "Bravo", "Alpha", "Charlie"]
    assert [account.name for account in by_name.items] == ["Alpha", "Bravo", "Charlie", "Delta"]
