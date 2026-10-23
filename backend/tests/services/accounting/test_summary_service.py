from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountCreate, AccountKind, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.summary import Summary
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import EntityStatusType
from app.services.accounting import summary_service


async def test_get_summary_ok(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    other_user_id: UUID = uuid4()

    # The base balances of the three accounts, 1000.00 + 1000.00 + 5298.51
    usd_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Checking",
            "currency": "USD",
            "balance": Decimal("1000.00"),
            "base_balance": Decimal("1000.00"),
        },
        commit=True,
    )
    eur_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Euro",
            "currency": "EUR",
            "balance": Decimal("920.00"),
            "base_balance": Decimal("1000.00"),
        },
        commit=True,
    )
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Savings",
            "currency": "GEL",
            "balance": Decimal("14200.00"),
            "base_balance": Decimal("5298.51"),
        },
        commit=True,
    )

    # A deleted account and another user's account are left out of the total balance
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Deleted",
            "currency": "USD",
            "balance": Decimal("500.00"),
            "base_balance": Decimal("500.00"),
            "status": EntityStatusType.DELETED,
        },
        commit=True,
    )
    other_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": other_user_id,
            "name": "Other",
            "currency": "USD",
            "balance": Decimal("700.00"),
            "base_balance": Decimal("700.00"),
        },
        commit=True,
    )

    income_source_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(user_id=user_id, kind=AccountKind.INCOME, name="Job"),
        commit=True,
    )
    other_income_source_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(user_id=other_user_id, kind=AccountKind.INCOME, name="Job"),
        commit=True,
    )
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=user_id,
            kind=AccountKind.EXPENSE,
            name="Food",
            category_type=CategoryType.VARIABLE,
        ),
        commit=True,
    )
    equity_db: AccountModel = await account_crud.create(
        db=db, obj_in=AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments"), commit=True
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )

    # Earned: the incomes on the first and the last day of October, 2000.00 + 312.00
    for transaction_date, amount in [(date(2026, 10, 1), Decimal("2000.00")), (date(2026, 10, 31), Decimal("312.00"))]:
        await transaction_crud.create_with_postings(
            db=db,
            obj_in=TransactionCreate(
                user_id=user_id,
                transaction_type=TransactionType.INCOME,
                transaction_date=transaction_date,
                base_currency_amount=amount,
                income_period=date(2026, 10, 1),
            ),
            postings=[
                PostingCreate(account_id=income_source_db.id, amount=-amount, currency="USD", base_amount=-amount),
                PostingCreate(account_id=usd_account_db.id, amount=amount, currency="USD", base_amount=amount),
            ],
        )
        await db.commit()

    # Spent: the active expenses of October, 1000.00 + 46.70
    for transaction_date, amount, status in [
        (date(2026, 10, 5), Decimal("1000.00"), EntityStatusType.ACTIVE),
        (date(2026, 10, 20), Decimal("46.70"), EntityStatusType.ACTIVE),
        (date(2026, 10, 10), Decimal("500.00"), EntityStatusType.DELETED),
    ]:
        expense_db: TransactionModel = await transaction_crud.create_with_postings(
            db=db,
            obj_in=TransactionCreate(
                user_id=user_id,
                transaction_type=TransactionType.EXPENSE,
                transaction_date=transaction_date,
                base_currency_amount=amount,
                location_id=location_db.id,
            ),
            postings=[
                PostingCreate(account_id=usd_account_db.id, amount=-amount, currency="USD", base_amount=-amount),
                PostingCreate(account_id=category_db.id, amount=amount, currency="USD", base_amount=amount),
            ],
        )
        await db.commit()
        await transaction_crud.update_orm(db=db, obj_in={"status": status}, id=expense_db.id, commit=True)

    # Outside October: the last day of September and the first day of November
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2026, 9, 30),
            base_currency_amount=Decimal("999.00"),
            income_period=date(2026, 9, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id,
                amount=Decimal("-999.00"),
                currency="USD",
                base_amount=Decimal("-999.00"),
            ),
            PostingCreate(
                account_id=usd_account_db.id, amount=Decimal("999.00"), currency="USD", base_amount=Decimal("999.00")
            ),
        ],
    )
    await db.commit()
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2026, 11, 1),
            base_currency_amount=Decimal("999.00"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=usd_account_db.id, amount=Decimal("-999.00"), currency="USD", base_amount=Decimal("-999.00")
            ),
            PostingCreate(
                account_id=category_db.id, amount=Decimal("999.00"), currency="USD", base_amount=Decimal("999.00")
            ),
        ],
    )
    await db.commit()

    # Transfers and adjustments are neither earned nor spent
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.TRANSFER,
            transaction_date=date(2026, 10, 10),
            base_currency_amount=Decimal("300.00"),
        ),
        postings=[
            PostingCreate(
                account_id=usd_account_db.id, amount=Decimal("-300.00"), currency="USD", base_amount=Decimal("-300.00")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("276.00"), currency="EUR", base_amount=Decimal("300.00")
            ),
        ],
    )
    await db.commit()
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.ADJUSTMENT,
            transaction_date=date(2026, 10, 10),
            base_currency_amount=Decimal("200.00"),
        ),
        postings=[
            PostingCreate(
                account_id=equity_db.id, amount=Decimal("-200.00"), currency="USD", base_amount=Decimal("-200.00")
            ),
            PostingCreate(
                account_id=usd_account_db.id, amount=Decimal("200.00"), currency="USD", base_amount=Decimal("200.00")
            ),
        ],
    )
    await db.commit()

    # Another user's income in October
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=other_user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2026, 10, 15),
            base_currency_amount=Decimal("5000.00"),
            income_period=date(2026, 10, 1),
        ),
        postings=[
            PostingCreate(
                account_id=other_income_source_db.id,
                amount=Decimal("-5000.00"),
                currency="USD",
                base_amount=Decimal("-5000.00"),
            ),
            PostingCreate(
                account_id=other_account_db.id,
                amount=Decimal("5000.00"),
                currency="USD",
                base_amount=Decimal("5000.00"),
            ),
        ],
    )
    await db.commit()

    # Act
    summary: Summary = await summary_service.get_summary(db=db, user_id=user_id, month=date(2026, 10, 15))

    # Assert
    assert summary.model_dump(mode="json") == {
        "month": "2026-10-01",
        "total_balance": "7298.51",
        "earned": "2312.00",
        "spent": "1046.70",
        "left_over": "1265.30",
    }


async def test_get_summary_empty_month(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Checking",
            "currency": "USD",
            "balance": Decimal("150.50"),
            "base_balance": Decimal("150.50"),
        },
        commit=True,
    )
    first_day_of_month: date = date.today().replace(day=1)

    # Act
    summary: Summary = await summary_service.get_summary(db=db, user_id=user_id, month=None)

    # Assert
    assert summary.model_dump(mode="json") == {
        "month": first_day_of_month.isoformat(),
        "total_balance": "150.50",
        "earned": "0.00",
        "spent": "0.00",
        "left_over": "0.00",
    }


async def test_get_summary_spent_more_than_earned(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Checking",
            "currency": "USD",
            "balance": Decimal("0"),
        },
        commit=True,
    )
    category_db: AccountModel = await account_crud.create(
        db=db,
        obj_in=AccountCreate(
            user_id=user_id,
            kind=AccountKind.EXPENSE,
            name="Rent",
            category_type=CategoryType.FIXED,
        ),
        commit=True,
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Landlord"), commit=True
    )
    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2026, 2, 28),
            base_currency_amount=Decimal("800.25"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=account_db.id, amount=Decimal("-800.25"), currency="USD", base_amount=Decimal("-800.25")
            ),
            PostingCreate(
                account_id=category_db.id, amount=Decimal("800.25"), currency="USD", base_amount=Decimal("800.25")
            ),
        ],
    )
    await db.commit()

    # Act
    summary: Summary = await summary_service.get_summary(db=db, user_id=user_id, month=date(2026, 2, 1))

    # Assert
    assert summary.model_dump(mode="json") == {
        "month": "2026-02-01",
        "total_balance": "0.00",
        "earned": "0.00",
        "spent": "800.25",
        "left_over": "-800.25",
    }


async def test_get_summary_account_without_rate(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Checking",
            "currency": "USD",
            "balance": Decimal("50.00"),
            "base_balance": Decimal("50.00"),
        },
        commit=True,
    )

    # An account outside the base currency that holds money but has no rate yet adds nothing
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Lari",
            "currency": "GEL",
            "balance": Decimal("-100.00"),
        },
        commit=True,
    )

    # Act
    summary: Summary = await summary_service.get_summary(db=db, user_id=user_id, month=date(2026, 10, 1))

    # Assert
    assert str(summary.total_balance) == "50.00"


async def test_get_summary_money_accounts_only(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.ASSET,
            "user_id": user_id,
            "name": "Checking",
            "currency": "USD",
            "balance": Decimal("50.00"),
            "base_balance": Decimal("50.00"),
        },
        commit=True,
    )
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.LIABILITY,
            "user_id": user_id,
            "name": "Credit card",
            "currency": "USD",
            "balance": Decimal("-20.00"),
            "base_balance": Decimal("-20.00"),
        },
        commit=True,
    )

    # A category with a balance and a rate, as the ledger will give it, is not money the user holds
    await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.EXPENSE,
            "user_id": user_id,
            "name": "Groceries",
            "category_type": CategoryType.VARIABLE,
            "balance": Decimal("70.00"),
            "base_balance": Decimal("70.00"),
        },
        commit=True,
    )

    # Act
    summary: Summary = await summary_service.get_summary(db=db, user_id=user_id, month=date(2026, 10, 1))

    # Assert
    assert summary.total_balance == Decimal("30.00")
