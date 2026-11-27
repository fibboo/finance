from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import Row, select, Select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from starlette import status

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden
from app.models.accounting.account import Account
from app.models.accounting.location import Location
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.models.user.user import User
from app.schemas.accounting.account import AccountKind, AdjustmentCreate, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import MovementRequest, Transaction as TransactionResponse, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.ledger_service import get_earliest_account_dates, recalculate_accounts
from app.services.accounting.transaction_processor.base import TransactionProcessor
from app.services.accounting.transaction_processor.factory import get_processor


async def test_batch_matches_creating_transactions_in_date_order(
    db: AsyncSession, db_transaction_factory: async_sessionmaker[AsyncSession]
) -> None:
    # arrange
    ledger_writes: dict[UUID, list[tuple[TransactionType, MovementRequest | AdjustmentCreate]]] = {}
    for username in ("sequential", "batch"):
        user: User = await user_crud.create(
            db=db,
            obj_in=UserCreate(username=username, registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
            commit=True,
        )
        user_id: UUID = user.id
        eur: Account = await account_crud.create(
            db=db,
            obj_in={"kind": AccountKind.ASSET, "user_id": user_id, "name": "Card", "currency": "EUR"},
            commit=True,
        )
        usd: Account = await account_crud.create(
            db=db,
            obj_in={
                "kind": AccountKind.ASSET,
                "user_id": user_id,
                "name": "Wallet",
                "currency": "USD",
                "balance": Decimal("200"),
                "base_balance": Decimal("200"),
            },
            commit=True,
        )
        debt: Account = await account_crud.create(
            db=db,
            obj_in={"kind": AccountKind.ASSET, "user_id": user_id, "name": "Debt", "currency": "EUR"},
            commit=True,
        )
        equity: Account = await account_crud.create(
            db=db, obj_in={"kind": AccountKind.EQUITY, "user_id": user_id, "name": "Adjustments"}, commit=True
        )
        source: Account = await account_crud.create(
            db=db, obj_in={"kind": AccountKind.INCOME, "user_id": user_id, "name": "Salary"}, commit=True
        )
        category: Account = await account_crud.create(
            db=db,
            obj_in={
                "kind": AccountKind.EXPENSE,
                "user_id": user_id,
                "name": "Food",
                "category_type": CategoryType.VARIABLE,
            },
            commit=True,
        )
        location: Location = await location_crud.create(
            db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
        )
        first_expense = MovementRequest(
            transaction_date=date(2025, 1, 1),
            from_account_id=eur.id,
            to_account_id=category.id,
            source_currency="EUR",
            destination_currency="EUR",
            source_amount=Decimal("100"),
            destination_amount=Decimal("100"),
            location_id=location.id,
        )
        repayment = MovementRequest(
            transaction_date=date(2025, 1, 2),
            from_account_id=source.id,
            to_account_id=eur.id,
            source_currency="USD",
            destination_currency="EUR",
            source_amount=Decimal("120"),
            destination_amount=Decimal("100"),
            income_period=date(2025, 1, 1),
        )
        adjustment = AdjustmentCreate(
            transaction_date=date(2025, 1, 3),
            account_id=debt.id,
            amount=Decimal("-50"),
            base_currency_amount=Decimal("55"),
        )
        transfer = MovementRequest(
            transaction_date=date(2025, 1, 4),
            from_account_id=usd.id,
            to_account_id=debt.id,
            source_currency="USD",
            destination_currency="EUR",
            source_amount=Decimal("65"),
            destination_amount=Decimal("50"),
        )
        income: MovementRequest = repayment.model_copy(
            update={"transaction_date": date(2025, 1, 5), "source_amount": Decimal("110")}
        )
        later_expense: MovementRequest = first_expense.model_copy(
            update={
                "transaction_date": date(2025, 1, 6),
                "source_amount": Decimal("20"),
                "destination_amount": Decimal("20"),
            }
        )
        async with db_transaction_factory.begin() as transaction_session:
            existing_expense: TransactionResponse = await get_processor(
                db=transaction_session, user_id=user_id, transaction_type=TransactionType.EXPENSE
            ).create(data=later_expense)

        assert existing_expense.base_currency_amount is None

        writes: list[tuple[TransactionType, MovementRequest | AdjustmentCreate]] = [
            (TransactionType.EXPENSE, first_expense),
            (TransactionType.INCOME, repayment),
            (TransactionType.ADJUSTMENT, adjustment),
            (TransactionType.TRANSFER, transfer),
            (TransactionType.INCOME, income),
        ]
        ledger_writes[user_id] = writes
    sequential_user_id, batch_user_id = ledger_writes
    for transaction_type, request in ledger_writes[sequential_user_id]:
        async with db_transaction_factory.begin() as transaction_session:
            await get_processor(
                db=transaction_session, user_id=sequential_user_id, transaction_type=transaction_type
            ).create(data=request)

    # act
    async with db_transaction_factory.begin() as transaction_session:
        account_dates: list[dict[UUID, date]] = []
        for transaction_type, request in ledger_writes[batch_user_id]:
            processor: TransactionProcessor = get_processor(
                db=transaction_session, user_id=batch_user_id, transaction_type=transaction_type
            )
            account_dates.append(await processor.add(data=request))

        first_expense_query: Select = select(Transaction.base_currency_amount).where(
            Transaction.user_id == batch_user_id, Transaction.transaction_date == first_expense.transaction_date
        )
        assert (await transaction_session.execute(first_expense_query)).scalar_one() is None
        earliest_dates: dict[UUID, date] = get_earliest_account_dates(account_dates=account_dates)
        await recalculate_accounts(db=transaction_session, account_dates=earliest_dates, base_currency="USD")

    # assert
    assert earliest_dates == {
        eur.id: first_expense.transaction_date,
        debt.id: adjustment.transaction_date,
        usd.id: transfer.transaction_date,
    }
    balances_query: Select = select(Account.name, Account.balance, Account.base_balance).order_by(Account.name)
    transactions_query: Select = select(
        Transaction.transaction_date,
        Transaction.transaction_type,
        Transaction.base_currency_amount,
        Transaction.valued_on,
    ).order_by(Transaction.transaction_date, Transaction.entry_order)
    postings_query: Select = (
        select(Transaction.transaction_date, Account.name, Posting.amount, Posting.currency, Posting.base_amount)
        .join(Transaction, Posting.transaction_id == Transaction.id)
        .join(Account, Posting.account_id == Account.id)
        .order_by(Transaction.transaction_date, Transaction.entry_order, Account.name, Posting.amount)
    )
    expected_balances: Sequence[Row] = (
        await db.execute(balances_query.where(Account.user_id == sequential_user_id))
    ).all()
    expected_transactions: Sequence[Row] = (
        await db.execute(transactions_query.where(Transaction.user_id == sequential_user_id))
    ).all()
    expected_postings: Sequence[Row] = (
        await db.execute(postings_query.where(Transaction.user_id == sequential_user_id))
    ).all()
    assert (await db.execute(balances_query.where(Account.user_id == batch_user_id))).all() == expected_balances
    assert (
        await db.execute(transactions_query.where(Transaction.user_id == batch_user_id))
    ).all() == expected_transactions
    assert (await db.execute(postings_query.where(Transaction.user_id == batch_user_id))).all() == expected_postings
    assert expected_transactions[0] == (
        first_expense.transaction_date,
        TransactionType.EXPENSE,
        Decimal("120"),
        repayment.transaction_date,
    )
    assert expected_transactions[-1] == (later_expense.transaction_date, TransactionType.EXPENSE, Decimal("22"), None)
    assert (transfer.transaction_date, debt.name, Decimal("0"), "EUR", Decimal("-10")) in expected_postings
    assert (transfer.transaction_date, equity.name, Decimal("0"), "EUR", Decimal("10")) in expected_postings


async def test_batch_rolls_back_when_recalculation_changes_deleted_account(
    db: AsyncSession, db_transaction_factory: async_sessionmaker[AsyncSession]
) -> None:
    # arrange
    user: User = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="batch", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    user_id: UUID = user.id
    eur: Account = await account_crud.create(
        db=db, obj_in={"kind": AccountKind.ASSET, "user_id": user_id, "name": "Card", "currency": "EUR"}, commit=True
    )
    usd: Account = await account_crud.create(
        db=db, obj_in={"kind": AccountKind.ASSET, "user_id": user_id, "name": "Wallet", "currency": "USD"}, commit=True
    )
    source: Account = await account_crud.create(
        db=db, obj_in={"kind": AccountKind.INCOME, "user_id": user_id, "name": "Salary"}, commit=True
    )
    category: Account = await account_crud.create(
        db=db,
        obj_in={
            "kind": AccountKind.EXPENSE,
            "user_id": user_id,
            "name": "Food",
            "category_type": CategoryType.VARIABLE,
        },
        commit=True,
    )
    location: Location = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )
    initial_income = MovementRequest(
        transaction_date=date(2025, 1, 1),
        from_account_id=source.id,
        to_account_id=eur.id,
        source_currency="USD",
        destination_currency="EUR",
        source_amount=Decimal("100"),
        destination_amount=Decimal("100"),
        income_period=date(2025, 1, 1),
    )
    async with db_transaction_factory.begin() as transaction_session:
        await get_processor(db=transaction_session, user_id=user_id, transaction_type=TransactionType.INCOME).create(
            data=initial_income
        )
    transfer = MovementRequest(
        transaction_date=date(2025, 1, 10),
        from_account_id=eur.id,
        to_account_id=usd.id,
        source_currency="EUR",
        destination_currency="USD",
        source_amount=Decimal("50"),
    )
    async with db_transaction_factory.begin() as transaction_session:
        await get_processor(db=transaction_session, user_id=user_id, transaction_type=TransactionType.TRANSFER).create(
            data=transfer
        )
    expense = MovementRequest(
        transaction_date=date(2025, 1, 15),
        from_account_id=usd.id,
        to_account_id=category.id,
        source_currency="USD",
        destination_currency="USD",
        source_amount=Decimal("50"),
        destination_amount=Decimal("50"),
        location_id=location.id,
    )
    async with db_transaction_factory.begin() as transaction_session:
        await get_processor(db=transaction_session, user_id=user_id, transaction_type=TransactionType.EXPENSE).create(
            data=expense
        )
    await account_crud.update_api(db=db, db_obj=usd, obj_in={"status": EntityStatusType.DELETED}, commit=True)

    back_dated_income: MovementRequest = initial_income.model_copy(
        update={"transaction_date": date(2025, 1, 5), "source_amount": Decimal("300")}
    )
    next_income: MovementRequest = initial_income.model_copy(
        update={"transaction_date": date(2025, 1, 6), "source_amount": Decimal("200")}
    )
    # act / assert
    with pytest.raises(DeletedAccountTransactionForbidden) as exc:
        async with db_transaction_factory.begin() as transaction_session:
            processor: TransactionProcessor = get_processor(
                db=transaction_session, user_id=user_id, transaction_type=TransactionType.INCOME
            )
            account_dates: list[dict[UUID, date]] = [
                await processor.add(data=back_dated_income),
                await processor.add(data=next_income),
            ]
            await recalculate_accounts(
                db=transaction_session,
                account_dates=get_earliest_account_dates(account_dates=account_dates),
                base_currency="USD",
            )

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN
    assert exc.value.log_message == (f"Account `{usd.id}` is deleted. Restore it to create or delete its transactions")
    transactions_query: Select = select(Transaction.transaction_date, Transaction.base_currency_amount).order_by(
        Transaction.transaction_date
    )
    assert (await db.execute(transactions_query)).all() == [
        (initial_income.transaction_date, Decimal("100")),
        (transfer.transaction_date, Decimal("50")),
        (expense.transaction_date, Decimal("50")),
    ]
    balances_query: Select = select(Account.id, Account.balance, Account.base_balance).where(
        Account.id.in_([eur.id, usd.id])
    )
    balances: dict[UUID, tuple[Decimal, Decimal]] = {
        account_id: (balance, base_balance) for account_id, balance, base_balance in (await db.execute(balances_query))
    }
    assert balances == {eur.id: (Decimal("50"), Decimal("50")), usd.id: (Decimal("0"), Decimal("0"))}
