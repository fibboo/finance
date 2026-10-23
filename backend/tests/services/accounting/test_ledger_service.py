from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountCreate, AccountKind, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import EntityStatusType
from app.services.accounting.ledger_service import recalculate_accounts


async def test_recalculate_accounts_back_dated_income_revalues_later_expense(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_id: UUID = uuid4()

    # The cache holds all three transactions: 100 + 100 - 50 EUR, valued 100 + 200 - 50 USD
    eur_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "kind": AccountKind.ASSET,
            "name": "Cash EUR",
            "currency": "EUR",
            "balance": Decimal("150"),
            "base_balance": Decimal("250"),
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
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )

    first_income_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 1),
            base_currency_amount=Decimal("100"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-100")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("100")
            ),
        ],
    )
    await db.commit()

    # Valued at the rate of the first income only, 1 EUR for 1 USD
    expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2025, 1, 10),
            base_currency_amount=Decimal("50"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-50")
            ),
            PostingCreate(account_id=category_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("50")),
        ],
    )
    await db.commit()

    back_dated_income_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 5),
            base_currency_amount=Decimal("200"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-200")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("200")
            ),
        ],
    )
    await db.commit()

    # Act
    await recalculate_accounts(db=db_transaction, transaction_db=back_dated_income_db, base_currency="USD")
    await db_transaction.commit()

    # Assert
    # The expense takes the average rate of both incomes: 50 * 300 / 200
    expense_amount = (
        await db.execute(select(TransactionModel.base_currency_amount).where(TransactionModel.id == expense_db.id))
    ).scalar_one()
    assert expense_amount == Decimal("75")

    expense_postings = (
        await db.execute(
            select(PostingModel.account_id, PostingModel.amount, PostingModel.base_amount)
            .where(PostingModel.transaction_id == expense_db.id)
            .order_by(PostingModel.amount)
        )
    ).all()
    assert [tuple(posting) for posting in expense_postings] == [
        (eur_account_db.id, Decimal("-50"), Decimal("-75")),
        (category_db.id, Decimal("50"), Decimal("75")),
    ]

    income_amounts = (
        (
            await db.execute(
                select(TransactionModel.base_currency_amount)
                .where(TransactionModel.id.in_([first_income_db.id, back_dated_income_db.id]))
                .order_by(TransactionModel.transaction_date)
            )
        )
        .scalars()
        .all()
    )
    assert income_amounts == [Decimal("100"), Decimal("200")]

    eur_account = (
        await db.execute(
            select(AccountModel.balance, AccountModel.base_balance).where(AccountModel.id == eur_account_db.id)
        )
    ).one()
    assert tuple(eur_account) == (Decimal("150"), Decimal("225"))


async def test_recalculate_accounts_deleted_income_revalues_later_expense(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_id: UUID = uuid4()

    # The cache holds the active transactions only: 100 - 50 EUR, valued 100 - 100 USD
    eur_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "kind": AccountKind.ASSET,
            "name": "Cash EUR",
            "currency": "EUR",
            "balance": Decimal("50"),
            "base_balance": Decimal("0"),
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
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )

    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 1),
            base_currency_amount=Decimal("100"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-100")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("100")
            ),
        ],
    )
    await db.commit()

    deleted_income_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 2),
            base_currency_amount=Decimal("300"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-300")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("300")
            ),
        ],
    )
    await db.commit()
    await transaction_crud.update_orm(
        db=db, obj_in={"status": EntityStatusType.DELETED}, id=deleted_income_db.id, commit=True
    )

    # Valued while both incomes were active: 50 * 400 / 200
    expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2025, 1, 10),
            base_currency_amount=Decimal("100"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-100")
            ),
            PostingCreate(account_id=category_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("100")),
        ],
    )
    await db.commit()

    # Act
    await recalculate_accounts(db=db_transaction, transaction_db=deleted_income_db, base_currency="USD")
    await db_transaction.commit()

    # Assert
    # The expense takes the rate of the remaining income: 50 * 100 / 100
    expense_postings = (
        await db.execute(
            select(PostingModel.account_id, PostingModel.amount, PostingModel.base_amount)
            .where(PostingModel.transaction_id == expense_db.id)
            .order_by(PostingModel.amount)
        )
    ).all()
    assert [tuple(posting) for posting in expense_postings] == [
        (eur_account_db.id, Decimal("-50"), Decimal("-50")),
        (category_db.id, Decimal("50"), Decimal("50")),
    ]

    expense_amount = (
        await db.execute(select(TransactionModel.base_currency_amount).where(TransactionModel.id == expense_db.id))
    ).scalar_one()
    assert expense_amount == Decimal("50")

    eur_account = (
        await db.execute(
            select(AccountModel.balance, AccountModel.base_balance).where(AccountModel.id == eur_account_db.id)
        )
    ).one()
    assert tuple(eur_account) == (Decimal("50"), Decimal("50"))


async def test_recalculate_accounts_debit_without_rate_keeps_base_amount(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_id: UUID = uuid4()

    # The only income is deleted, so the cache holds the expense alone
    eur_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "kind": AccountKind.ASSET,
            "name": "Cash EUR",
            "currency": "EUR",
            "balance": Decimal("-50"),
            "base_balance": Decimal("-60"),
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
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )

    deleted_income_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 1),
            base_currency_amount=Decimal("120"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-120")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("120")
            ),
        ],
    )
    await db.commit()
    await transaction_crud.update_orm(
        db=db, obj_in={"status": EntityStatusType.DELETED}, id=deleted_income_db.id, commit=True
    )

    expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2025, 1, 10),
            base_currency_amount=Decimal("60"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-60")
            ),
            PostingCreate(account_id=category_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("60")),
        ],
    )
    await db.commit()

    # Act
    await recalculate_accounts(db=db_transaction, transaction_db=deleted_income_db, base_currency="USD")
    await db_transaction.commit()

    # Assert
    expense_postings = (
        await db.execute(
            select(PostingModel.account_id, PostingModel.amount, PostingModel.base_amount)
            .where(PostingModel.transaction_id == expense_db.id)
            .order_by(PostingModel.amount)
        )
    ).all()
    assert [tuple(posting) for posting in expense_postings] == [
        (eur_account_db.id, Decimal("-50"), Decimal("-60")),
        (category_db.id, Decimal("50"), Decimal("60")),
    ]

    eur_account = (
        await db.execute(
            select(AccountModel.balance, AccountModel.base_balance).where(AccountModel.id == eur_account_db.id)
        )
    ).one()
    assert tuple(eur_account) == (Decimal("-50"), Decimal("-60"))


async def test_recalculate_accounts_revalued_transfers_recalculate_receiving_accounts(
    db: AsyncSession, db_transaction: AsyncSession
):
    # Arrange
    user_id: UUID = uuid4()

    # Income 100 + back-dated income 100, transfers out 50 and 25 EUR, valued 100 + 300 - 50 - 25 USD
    eur_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "kind": AccountKind.ASSET,
            "name": "Cash EUR",
            "currency": "EUR",
            "balance": Decimal("125"),
            "base_balance": Decimal("325"),
        },
        commit=True,
    )
    # Transfer in 50 EUR, then an expense of all 50 EUR
    savings_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "kind": AccountKind.ASSET,
            "name": "Savings EUR",
            "currency": "EUR",
            "balance": Decimal("0"),
            "base_balance": Decimal("0"),
        },
        commit=True,
    )
    # Transfer in 25 USD, derived from the base amount of the transfer
    usd_account_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": user_id,
            "kind": AccountKind.ASSET,
            "name": "Cash USD",
            "currency": "USD",
            "balance": Decimal("25"),
            "base_balance": Decimal("25"),
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
        db=db, obj_in=LocationCreate(user_id=user_id, name="Shop"), commit=True
    )

    await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 1),
            base_currency_amount=Decimal("100"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-100")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("100")
            ),
        ],
    )
    await db.commit()

    savings_transfer_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.TRANSFER,
            transaction_date=date(2025, 1, 10),
            base_currency_amount=Decimal("50"),
        ),
        postings=[
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-50")
            ),
            PostingCreate(account_id=savings_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("50")),
        ],
    )
    await db.commit()

    usd_transfer_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.TRANSFER,
            transaction_date=date(2025, 1, 11),
            base_currency_amount=Decimal("25"),
        ),
        postings=[
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("-25"), currency="EUR", base_amount=Decimal("-25")
            ),
            PostingCreate(
                account_id=usd_account_db.id, amount=Decimal("25"), currency="USD", base_amount=Decimal("25")
            ),
        ],
    )
    await db.commit()

    savings_expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2025, 1, 20),
            base_currency_amount=Decimal("50"),
            location_id=location_db.id,
        ),
        postings=[
            PostingCreate(account_id=savings_db.id, amount=Decimal("-50"), currency="EUR", base_amount=Decimal("-50")),
            PostingCreate(account_id=category_db.id, amount=Decimal("50"), currency="EUR", base_amount=Decimal("50")),
        ],
    )
    await db.commit()

    back_dated_income_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=user_id,
            transaction_type=TransactionType.INCOME,
            transaction_date=date(2025, 1, 5),
            base_currency_amount=Decimal("300"),
            income_period=date(2025, 1, 1),
        ),
        postings=[
            PostingCreate(
                account_id=income_source_db.id, amount=Decimal("-100"), currency="EUR", base_amount=Decimal("-300")
            ),
            PostingCreate(
                account_id=eur_account_db.id, amount=Decimal("100"), currency="EUR", base_amount=Decimal("300")
            ),
        ],
    )
    await db.commit()

    # Act
    await recalculate_accounts(db=db_transaction, transaction_db=back_dated_income_db, base_currency="USD")
    await db_transaction.commit()

    # Assert
    transaction_ids: list[UUID] = [savings_transfer_db.id, usd_transfer_db.id, savings_expense_db.id]
    transaction_amounts = (
        (
            await db.execute(
                select(TransactionModel.base_currency_amount)
                .where(TransactionModel.id.in_(transaction_ids))
                .order_by(TransactionModel.transaction_date)
            )
        )
        .scalars()
        .all()
    )
    assert transaction_amounts == [Decimal("100"), Decimal("50"), Decimal("100")]

    # 50 * 400 / 200 to savings, 25 * 300 / 150 to USD, which also receives the derived amount,
    # and the expense that empties savings takes all of its base value
    postings = (
        await db.execute(
            select(PostingModel.account_id, PostingModel.amount, PostingModel.base_amount)
            .join(TransactionModel, TransactionModel.id == PostingModel.transaction_id)
            .where(PostingModel.transaction_id.in_(transaction_ids))
            .order_by(TransactionModel.transaction_date, PostingModel.amount)
        )
    ).all()
    assert [tuple(posting) for posting in postings] == [
        (eur_account_db.id, Decimal("-50"), Decimal("-100")),
        (savings_db.id, Decimal("50"), Decimal("100")),
        (eur_account_db.id, Decimal("-25"), Decimal("-50")),
        (usd_account_db.id, Decimal("50"), Decimal("50")),
        (savings_db.id, Decimal("-50"), Decimal("-100")),
        (category_db.id, Decimal("50"), Decimal("100")),
    ]

    accounts = (
        await db.execute(
            select(AccountModel.id, AccountModel.balance, AccountModel.base_balance)
            .where(AccountModel.id.in_([eur_account_db.id, savings_db.id, usd_account_db.id]))
            .order_by(AccountModel.name)
        )
    ).all()
    assert [tuple(account) for account in accounts] == [
        (eur_account_db.id, Decimal("125"), Decimal("250")),
        (usd_account_db.id, Decimal("50"), Decimal("50")),
        (savings_db.id, Decimal("0"), Decimal("0")),
    ]
