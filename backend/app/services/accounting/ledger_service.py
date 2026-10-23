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
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import MONEY_ACCOUNT_KINDS
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


async def get_balances_at_date(
    *, db: AsyncSession, account_db: AccountModel, transaction_date: date
) -> tuple[Decimal, Decimal]:
    later_sums: Row = await posting_crud.get_sums_after_date(
        db=db, account_id=account_db.id, transaction_date=transaction_date
    )
    balances: tuple[Decimal, Decimal] = (
        account_db.balance - later_sums.amount,
        account_db.base_balance - later_sums.base_amount,
    )
    return balances


def _get_revalued_amounts(
    *, account_db: AccountModel, transactions_db: list[TransactionModel], base_currency: CurrencyCode
) -> dict[UUID, Decimal]:
    adjustment_ids: set[UUID] = {
        transaction_db.id
        for transaction_db in transactions_db
        if transaction_db.transaction_type == TransactionType.ADJUSTMENT
    }
    postings_db: list[PostingModel] = [
        posting_db
        for transaction_db in transactions_db
        for posting_db in transaction_db.postings
        if posting_db.account_id == account_db.id
    ]
    balance: Decimal = account_db.balance - sum(posting_db.amount for posting_db in postings_db)
    base_balance: Decimal = account_db.base_balance - sum(posting_db.base_amount for posting_db in postings_db)

    revalued_amounts: dict[UUID, Decimal] = {}
    for posting_db in postings_db:
        has_rate: bool = has_base_currency_rate(
            currency=account_db.currency, balance=balance, base_balance=base_balance, base_currency=base_currency
        )
        is_valued_at_rate: bool = posting_db.amount < 0 or posting_db.transaction_id in adjustment_ids
        base_amount: Decimal = posting_db.base_amount
        if is_valued_at_rate and has_rate:
            base_currency_amount: Decimal = get_base_amount(
                currency=account_db.currency,
                balance=balance,
                base_balance=base_balance,
                amount=abs(posting_db.amount),
                base_currency=base_currency,
            )
            base_amount: Decimal = base_currency_amount if posting_db.amount > 0 else -base_currency_amount

        if base_amount != posting_db.base_amount:
            revalued_amounts[posting_db.transaction_id] = abs(base_amount)

        balance += posting_db.amount
        base_balance += base_amount

    return revalued_amounts


def _get_revalued_postings(
    *,
    account_id: UUID,
    transactions_db: list[TransactionModel],
    revalued_amounts: dict[UUID, Decimal],
    base_currency: CurrencyCode,
) -> dict[UUID, tuple[Decimal, Decimal]]:
    revalued_postings: dict[UUID, tuple[Decimal, Decimal]] = {}
    for transaction_db in transactions_db:
        base_currency_amount: Decimal | None = revalued_amounts.get(transaction_db.id)
        if base_currency_amount is None:
            continue

        for posting_db in transaction_db.postings:
            base_amount: Decimal = base_currency_amount if posting_db.amount > 0 else -base_currency_amount
            is_derived_amount: bool = (
                posting_db.account_id != account_id
                and posting_db.account.kind in MONEY_ACCOUNT_KINDS
                and posting_db.currency == base_currency
            )
            amount: Decimal = base_amount if is_derived_amount else posting_db.amount
            revalued_postings[posting_db.id] = (amount, base_amount)

    return revalued_postings


async def recalculate_accounts(
    *, db: AsyncSession, transaction_db: TransactionModel, base_currency: CurrencyCode
) -> None:
    pending_dates: dict[UUID, date] = {}
    for posting_db in transaction_db.postings:
        if posting_db.account.kind in MONEY_ACCOUNT_KINDS:
            pending_dates[posting_db.account_id] = transaction_db.transaction_date

    changed_accounts_db: dict[UUID, AccountModel] = {}
    balance_changes: dict[UUID, tuple[Decimal, Decimal]] = {}
    while len(pending_dates) > 0:
        account_id: UUID = min(pending_dates, key=pending_dates.get)
        date_from: date = pending_dates.pop(account_id)
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(db=db, ids=[account_id])
        transactions_db: list[TransactionModel] = await transaction_crud.get_account_transactions_from_date(
            db=db, account_id=account_id, date_from=date_from
        )
        revalued_amounts: dict[UUID, Decimal] = _get_revalued_amounts(
            account_db=accounts_db[account_id], transactions_db=transactions_db, base_currency=base_currency
        )
        revalued_postings: dict[UUID, tuple[Decimal, Decimal]] = _get_revalued_postings(
            account_id=account_id,
            transactions_db=transactions_db,
            revalued_amounts=revalued_amounts,
            base_currency=base_currency,
        )
        for revalued_transaction_db in transactions_db:
            for posting_db in revalued_transaction_db.postings:
                revalued_posting: tuple[Decimal, Decimal] | None = revalued_postings.get(posting_db.id)
                if revalued_posting is None or posting_db.account.kind not in MONEY_ACCOUNT_KINDS:
                    continue

                amount_change: Decimal = revalued_posting[0] - posting_db.amount
                base_amount_change: Decimal = revalued_posting[1] - posting_db.base_amount
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
            await transaction_crud.update_base_currency_amounts(db=db, amounts=revalued_amounts)

    for changed_account_id, (amount_change, base_amount_change) in balance_changes.items():
        is_deleted: bool = changed_accounts_db[changed_account_id].status == EntityStatusType.DELETED
        if is_deleted and (amount_change != 0 or base_amount_change != 0):
            raise DeletedAccountTransactionForbidden(account_id=changed_account_id, logger=logger)
