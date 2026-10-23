from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.posting import posting_crud
from app.crud.accounting.transaction import transaction_crud
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import MONEY_ACCOUNT_KINDS
from app.schemas.base import CurrencyCode
from app.utils import utils


def has_base_currency_rate(
    *, currency: CurrencyCode | None, balance: Decimal, base_balance: Decimal, base_currency: CurrencyCode
) -> bool:
    base_currency_rate: Decimal = utils.get_base_currency_rate(balance=balance, base_balance=base_balance)
    has_rate: bool = currency == base_currency or base_currency_rate > 0
    return has_rate


def get_debit_base_amount(
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


def _get_revalued_amounts(
    *, account_db: AccountModel, transactions_db: list[TransactionModel], base_currency: CurrencyCode
) -> dict[UUID, Decimal]:
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
        base_amount: Decimal = posting_db.base_amount
        if posting_db.amount < 0 and has_rate:
            base_amount: Decimal = -get_debit_base_amount(
                currency=account_db.currency,
                balance=balance,
                base_balance=base_balance,
                amount=-posting_db.amount,
                base_currency=base_currency,
            )

        if base_amount != posting_db.base_amount:
            revalued_amounts[posting_db.transaction_id] = -base_amount

        balance += posting_db.amount
        base_balance += base_amount

    return revalued_amounts


async def _recalculate_account(
    *, db: AsyncSession, account_id: UUID, date_from: date, base_currency: CurrencyCode
) -> dict[UUID, date]:
    accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(db=db, ids=[account_id])
    transactions_db: list[TransactionModel] = await transaction_crud.get_account_transactions_from_date(
        db=db, account_id=account_id, date_from=date_from
    )
    revalued_amounts: dict[UUID, Decimal] = _get_revalued_amounts(
        account_db=accounts_db[account_id], transactions_db=transactions_db, base_currency=base_currency
    )

    postings: list[dict[str, Any]] = []
    balance_changes: dict[UUID, tuple[Decimal, Decimal]] = {}
    next_dates: dict[UUID, date] = {}
    for transaction_db in transactions_db:
        base_currency_amount: Decimal | None = revalued_amounts.get(transaction_db.id)
        if base_currency_amount is None:
            continue

        for posting_db in transaction_db.postings:
            is_money_account: bool = posting_db.account.kind in MONEY_ACCOUNT_KINDS
            if posting_db.account_id == account_id:
                amount, base_amount = posting_db.amount, -base_currency_amount
            elif is_money_account and posting_db.currency == base_currency:
                amount, base_amount = base_currency_amount, base_currency_amount
            else:
                amount, base_amount = posting_db.amount, base_currency_amount

            postings.append({"id": posting_db.id, "amount": amount, "base_amount": base_amount})
            if is_money_account:
                amount_change, base_amount_change = balance_changes.get(
                    posting_db.account_id, (Decimal("0"), Decimal("0"))
                )
                balance_changes[posting_db.account_id] = (
                    amount_change + amount - posting_db.amount,
                    base_amount_change + base_amount - posting_db.base_amount,
                )

            if is_money_account and posting_db.account_id != account_id:
                next_dates.setdefault(posting_db.account_id, transaction_db.transaction_date)

    if len(revalued_amounts) > 0:
        await posting_crud.update_amounts(db=db, postings=postings)
        await transaction_crud.update_base_currency_amounts(db=db, amounts=revalued_amounts)

    for changed_account_id, (amount_change, base_amount_change) in balance_changes.items():
        await account_crud.add_to_balance(
            db=db, account_id=changed_account_id, amount=amount_change, base_amount=base_amount_change
        )

    return next_dates


async def recalculate_accounts(
    *, db: AsyncSession, transaction_db: TransactionModel, base_currency: CurrencyCode
) -> None:
    pending_dates: dict[UUID, date] = {}
    for posting_db in transaction_db.postings:
        if posting_db.account.kind in MONEY_ACCOUNT_KINDS:
            pending_dates[posting_db.account_id] = transaction_db.transaction_date

    while len(pending_dates) > 0:
        account_id: UUID = min(pending_dates, key=pending_dates.get)
        date_from: date = pending_dates.pop(account_id)
        next_dates: dict[UUID, date] = await _recalculate_account(
            db=db, account_id=account_id, date_from=date_from, base_currency=base_currency
        )
        for next_account_id, next_date in next_dates.items():
            pending_dates[next_account_id] = min(pending_dates.get(next_account_id, next_date), next_date)
