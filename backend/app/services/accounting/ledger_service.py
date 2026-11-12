from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.posting import posting_crud
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountKind, MONEY_ACCOUNT_KINDS
from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import CurrencyCode, EntityStatusType
from app.utils import utils

logger = get_logger(logger_name=__name__)


def has_base_currency_rate(
    *, currency: CurrencyCode | None, balance: Decimal, base_balance: Decimal, base_currency: CurrencyCode
) -> bool:
    base_currency_rate: Decimal = utils.get_base_currency_rate(balance=balance, base_balance=base_balance)
    has_rate: bool = currency == base_currency or base_currency_rate > 0
    return has_rate


def get_base_amount(
    *,
    currency: CurrencyCode | None,
    balance: Decimal,
    base_balance: Decimal,
    amount: Decimal,
    base_currency: CurrencyCode,
) -> Decimal:
    if currency == base_currency:
        base_amount: Decimal = amount
    elif amount == abs(balance):
        base_amount: Decimal = abs(base_balance)
    else:
        base_amount: Decimal = max(utils.round_to_cents(amount=amount * base_balance / balance), Decimal("0.01"))

    return base_amount


def get_valued_amount(*, base_amount: Decimal | None) -> Decimal:
    valued_amount: Decimal = Decimal("0") if base_amount is None else base_amount
    return valued_amount


def get_money_account_dates(*, transaction_db: TransactionModel) -> dict[UUID, date]:
    account_dates: dict[UUID, date] = {}
    for posting_db in transaction_db.postings:
        if posting_db.account.kind in MONEY_ACCOUNT_KINDS:
            account_dates[posting_db.account_id] = transaction_db.transaction_date

    return account_dates


def get_exchange_difference(
    *,
    currency: CurrencyCode | None,
    balance: Decimal,
    base_balance: Decimal,
    amount: Decimal,
    base_amount: Decimal,
    base_currency: CurrencyCode,
) -> Decimal:
    new_balance: Decimal = balance + amount
    if balance > 0 or new_balance < 0:
        return Decimal("0")

    if new_balance == 0:
        new_base_balance: Decimal = Decimal("0")
    else:
        new_base_balance: Decimal = get_base_amount(
            currency=currency, balance=amount, base_balance=base_amount, amount=new_balance, base_currency=base_currency
        )

    exchange_difference: Decimal = new_base_balance - base_balance - base_amount
    return exchange_difference


async def get_balances_at_date(
    *, db: AsyncSession, account_db: AccountModel, transaction_date: date, excluded_transaction_id: UUID | None = None
) -> tuple[Decimal, Decimal]:
    sums: Row = await posting_crud.get_sums_at_date(
        db=db,
        account_id=account_db.id,
        transaction_date=transaction_date,
        excluded_transaction_id=excluded_transaction_id,
    )
    balances: tuple[Decimal, Decimal] = (
        account_db.balance - sums.later_amount - sums.waiting_amount - sums.excluded_amount,
        account_db.base_balance - sums.later_base_amount - sums.waiting_base_amount - sums.excluded_base_amount,
    )
    return balances


def _get_revalued_amounts(
    *, account_db: AccountModel, transactions_db: list[TransactionModel], base_currency: CurrencyCode
) -> tuple[dict[UUID, Decimal | None], dict[UUID, date | None], dict[UUID, Decimal]]:
    transactions_by_id: dict[UUID, TransactionModel] = {
        transaction_db.id: transaction_db for transaction_db in transactions_db
    }
    postings_db: list[PostingModel] = [
        posting_db
        for transaction_db in transactions_db
        for posting_db in transaction_db.postings
        if posting_db.account_id == account_db.id
    ]
    exchange_postings_db: dict[UUID, PostingModel] = {
        posting_db.transaction_id: posting_db for posting_db in postings_db if posting_db.amount == 0
    }
    balance: Decimal = account_db.balance - sum(posting_db.amount for posting_db in postings_db)
    base_balance: Decimal = account_db.base_balance - sum(
        get_valued_amount(base_amount=posting_db.base_amount) for posting_db in postings_db
    )

    revalued_amounts: dict[UUID, Decimal | None] = {}
    valued_dates: dict[UUID, date | None] = {}
    exchange_differences: dict[UUID, Decimal] = {}
    waiting_postings_db: list[PostingModel] = []
    for posting_db in postings_db:
        if posting_db.amount == 0:
            continue

        transaction_db: TransactionModel = transactions_by_id[posting_db.transaction_id]
        valued_balance: Decimal = balance - sum(waiting_posting_db.amount for waiting_posting_db in waiting_postings_db)
        has_rate: bool = has_base_currency_rate(
            currency=account_db.currency, balance=valued_balance, base_balance=base_balance, base_currency=base_currency
        )
        is_adjustment: bool = transaction_db.transaction_type == TransactionType.ADJUSTMENT
        is_expense_debit: bool = posting_db.amount < 0 and transaction_db.transaction_type == TransactionType.EXPENSE
        base_amount: Decimal | None = posting_db.base_amount
        exchange_difference: Decimal = Decimal("0")
        if (posting_db.amount < 0 or is_adjustment) and has_rate:
            base_currency_amount: Decimal = get_base_amount(
                currency=account_db.currency,
                balance=valued_balance,
                base_balance=base_balance,
                amount=abs(posting_db.amount),
                base_currency=base_currency,
            )
            base_amount: Decimal = base_currency_amount if posting_db.amount > 0 else -base_currency_amount
        elif is_expense_debit:
            waiting_postings_db.append(posting_db)
            balance += posting_db.amount
            continue
        elif posting_db.amount > 0 and not is_adjustment:
            for waiting_posting_db in waiting_postings_db:
                waiting_base_amount: Decimal = get_base_amount(
                    currency=account_db.currency,
                    balance=posting_db.amount,
                    base_balance=base_amount,
                    amount=abs(waiting_posting_db.amount),
                    base_currency=base_currency,
                )
                if -waiting_base_amount != waiting_posting_db.base_amount:
                    revalued_amounts[waiting_posting_db.transaction_id] = waiting_base_amount

                if transactions_by_id[waiting_posting_db.transaction_id].valued_on != transaction_db.transaction_date:
                    valued_dates[waiting_posting_db.transaction_id] = transaction_db.transaction_date

                base_balance -= waiting_base_amount

            waiting_postings_db = []
            exchange_difference: Decimal = get_exchange_difference(
                currency=account_db.currency,
                balance=balance,
                base_balance=base_balance,
                amount=posting_db.amount,
                base_amount=base_amount,
                base_currency=base_currency,
            )

        exchange_posting_db: PostingModel | None = exchange_postings_db.get(posting_db.transaction_id)
        stored_exchange_difference: Decimal = (
            Decimal("0") if exchange_posting_db is None else exchange_posting_db.base_amount
        )
        if exchange_difference != stored_exchange_difference:
            exchange_differences[posting_db.transaction_id] = exchange_difference

        if base_amount != posting_db.base_amount:
            revalued_amounts[posting_db.transaction_id] = abs(base_amount)

        if transaction_db.valued_on is not None:
            valued_dates[posting_db.transaction_id] = None

        balance += posting_db.amount
        base_balance += get_valued_amount(base_amount=base_amount) + exchange_difference

    for waiting_posting_db in waiting_postings_db:
        if waiting_posting_db.base_amount is not None:
            revalued_amounts[waiting_posting_db.transaction_id] = None

        if transactions_by_id[waiting_posting_db.transaction_id].valued_on is not None:
            valued_dates[waiting_posting_db.transaction_id] = None

    return revalued_amounts, valued_dates, exchange_differences


def _get_revalued_postings(
    *,
    account_id: UUID,
    transactions_db: list[TransactionModel],
    revalued_amounts: dict[UUID, Decimal | None],
    exchange_differences: dict[UUID, Decimal],
    base_currency: CurrencyCode,
) -> dict[UUID, tuple[Decimal, Decimal | None]]:
    revalued_postings: dict[UUID, tuple[Decimal, Decimal | None]] = {}
    for transaction_db in transactions_db:
        exchange_difference: Decimal = exchange_differences.get(transaction_db.id, Decimal("0"))
        for posting_db in transaction_db.postings:
            if posting_db.amount == 0 and exchange_difference != 0:
                is_account_posting: bool = posting_db.account_id == account_id
                base_amount: Decimal = exchange_difference if is_account_posting else -exchange_difference
                revalued_postings[posting_db.id] = (posting_db.amount, base_amount)

            if posting_db.amount == 0 or transaction_db.id not in revalued_amounts:
                continue

            base_currency_amount: Decimal | None = revalued_amounts[transaction_db.id]
            if base_currency_amount is None:
                revalued_postings[posting_db.id] = (posting_db.amount, None)
                continue

            base_amount: Decimal = base_currency_amount if posting_db.amount > 0 else -base_currency_amount
            is_derived_amount: bool = (
                posting_db.account_id != account_id
                and posting_db.account.kind in MONEY_ACCOUNT_KINDS
                and posting_db.currency == base_currency
            )
            amount: Decimal = base_amount if is_derived_amount else posting_db.amount
            revalued_postings[posting_db.id] = (amount, base_amount)

    return revalued_postings


def _get_exchange_changes(
    *, transactions_db: list[TransactionModel], exchange_differences: dict[UUID, Decimal]
) -> tuple[dict[UUID, Decimal], list[PostingModel]]:
    created_differences: dict[UUID, Decimal] = {}
    removed_postings_db: list[PostingModel] = []
    for transaction_db in transactions_db:
        exchange_difference: Decimal | None = exchange_differences.get(transaction_db.id)
        if exchange_difference is None:
            continue

        exchange_postings_db: list[PostingModel] = [
            posting_db for posting_db in transaction_db.postings if posting_db.amount == 0
        ]
        if exchange_difference == 0:
            removed_postings_db.extend(exchange_postings_db)
        elif len(exchange_postings_db) == 0:
            created_differences[transaction_db.id] = exchange_difference

    return created_differences, removed_postings_db


def _get_exchange_postings(
    *, account_db: AccountModel, equity_account_id: UUID, created_differences: dict[UUID, Decimal]
) -> list[dict]:
    new_postings: list[dict] = []
    for transaction_id, exchange_difference in created_differences.items():
        new_postings.extend(
            [
                {
                    "transaction_id": transaction_id,
                    "account_id": account_db.id,
                    "amount": Decimal("0"),
                    "currency": account_db.currency,
                    "base_amount": exchange_difference,
                },
                {
                    "transaction_id": transaction_id,
                    "account_id": equity_account_id,
                    "amount": Decimal("0"),
                    "currency": account_db.currency,
                    "base_amount": -exchange_difference,
                },
            ]
        )

    return new_postings


async def recalculate_accounts(
    *, db: AsyncSession, account_dates: dict[UUID, date], base_currency: CurrencyCode
) -> None:
    pending_dates: dict[UUID, date] = dict(account_dates)
    equity_account_db: AccountModel | None = None
    changed_accounts_db: dict[UUID, AccountModel] = {}
    balance_changes: dict[UUID, tuple[Decimal, Decimal]] = {}
    while len(pending_dates) > 0:
        account_id: UUID = min(pending_dates, key=pending_dates.get)
        date_from: date = pending_dates.pop(account_id)
        first_revaluable_date: date | None = await posting_crud.get_first_revaluable_date(
            db=db, account_id=account_id, date_from=date_from
        )
        if first_revaluable_date is not None:
            date_from: date = min(date_from, first_revaluable_date)

        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(db=db, ids=[account_id])
        account_db: AccountModel = accounts_db[account_id]
        transactions_db: list[TransactionModel] = await transaction_crud.get_account_transactions_from_date(
            db=db, account_id=account_id, date_from=date_from
        )
        revalued_amounts, valued_dates, exchange_differences = _get_revalued_amounts(
            account_db=account_db, transactions_db=transactions_db, base_currency=base_currency
        )
        revalued_postings: dict[UUID, tuple[Decimal, Decimal | None]] = _get_revalued_postings(
            account_id=account_id,
            transactions_db=transactions_db,
            revalued_amounts=revalued_amounts,
            exchange_differences=exchange_differences,
            base_currency=base_currency,
        )
        created_differences, removed_postings_db = _get_exchange_changes(
            transactions_db=transactions_db, exchange_differences=exchange_differences
        )
        new_postings: list[dict] = []
        if len(created_differences) > 0:
            if equity_account_db is None:
                equity_account_db: AccountModel | None = await account_crud.get_or_none(
                    db=db, user_id=account_db.user_id, kind=AccountKind.EQUITY, status=EntityStatusType.ACTIVE
                )

            if equity_account_db is None:
                raise EntityNotFound(
                    entity=AccountModel,
                    search_params={"user_id": account_db.user_id, "kind": AccountKind.EQUITY},
                    logger=logger,
                )

            new_postings: list[dict] = _get_exchange_postings(
                account_db=account_db, equity_account_id=equity_account_db.id, created_differences=created_differences
            )

        exchange_base_change: Decimal = sum(created_differences.values()) - sum(
            posting_db.base_amount for posting_db in removed_postings_db if posting_db.account_id == account_id
        )
        if exchange_base_change != 0:
            await account_crud.add_to_balance(
                db=db, account_id=account_id, amount=Decimal("0"), base_amount=exchange_base_change
            )
            total_amount_change, total_base_amount_change = balance_changes.get(
                account_id, (Decimal("0"), Decimal("0"))
            )
            balance_changes[account_id] = (total_amount_change, total_base_amount_change + exchange_base_change)
            changed_accounts_db[account_id] = account_db

        for revalued_transaction_db in transactions_db:
            for posting_db in revalued_transaction_db.postings:
                revalued_posting: tuple[Decimal, Decimal | None] | None = revalued_postings.get(posting_db.id)
                if revalued_posting is None or posting_db.account.kind not in MONEY_ACCOUNT_KINDS:
                    continue

                amount_change: Decimal = revalued_posting[0] - posting_db.amount
                base_amount_change: Decimal = get_valued_amount(base_amount=revalued_posting[1]) - get_valued_amount(
                    base_amount=posting_db.base_amount
                )
                await account_crud.add_to_balance(
                    db=db, account_id=posting_db.account_id, amount=amount_change, base_amount=base_amount_change
                )

                total_amount_change, total_base_amount_change = balance_changes.get(
                    posting_db.account_id, (Decimal("0"), Decimal("0"))
                )
                balance_changes[posting_db.account_id] = (
                    total_amount_change + amount_change,
                    total_base_amount_change + base_amount_change,
                )
                changed_accounts_db[posting_db.account_id] = posting_db.account

                next_date: date = revalued_transaction_db.transaction_date
                if posting_db.account_id != account_id:
                    pending_dates[posting_db.account_id] = min(
                        pending_dates.get(posting_db.account_id, next_date), next_date
                    )

        if len(revalued_postings) > 0:
            await posting_crud.update_amounts(db=db, amounts=revalued_postings)

        if len(revalued_amounts) > 0:
            await transaction_crud.update_base_currency_amounts(db=db, amounts=revalued_amounts)

        if len(valued_dates) > 0:
            await transaction_crud.update_valued_dates(db=db, valued_dates=valued_dates)

        if len(new_postings) > 0:
            await posting_crud.create_batch(db=db, objs_in=new_postings)

        if len(removed_postings_db) > 0:
            await posting_crud.delete_by_ids(db=db, ids=[posting_db.id for posting_db in removed_postings_db])

    for changed_account_id, (amount_change, base_amount_change) in balance_changes.items():
        is_deleted: bool = changed_accounts_db[changed_account_id].status == EntityStatusType.DELETED
        if is_deleted and (amount_change != 0 or base_amount_change != 0):
            raise DeletedAccountTransactionForbidden(account_id=changed_account_id, logger=logger)
