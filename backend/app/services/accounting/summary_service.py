import calendar
from datetime import date, datetime, UTC
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import transaction_crud
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.summary import CurrencyAmount, Summary
from app.schemas.base import CurrencyCode
from app.services.accounting import account_service, exchange_rate_service
from app.utils import utils


def _get_month_bounds(*, month: date) -> tuple[date, date]:
    days_in_month: int = calendar.monthrange(month.year, month.month)[1]
    month_bounds: tuple[date, date] = (month.replace(day=1), month.replace(day=days_in_month))
    return month_bounds


def _get_total_balance(*, accounts_db: list[AccountModel]) -> Decimal:
    total_balance: Decimal = Decimal("0.00")
    for account_db in accounts_db:
        total_balance += utils.round_to_cents(amount=account_db.base_balance)

    return total_balance


def _get_estimated_total_balance(
    *, accounts_db: list[AccountModel], estimated_base_balances: dict[UUID, Decimal | None]
) -> Decimal | None:
    if len(estimated_base_balances) == 0 or None in estimated_base_balances.values():
        return None

    estimated_total_balance: Decimal = Decimal("0.00")
    for account_db in accounts_db:
        estimated_base_balance: Decimal | None = estimated_base_balances.get(account_db.id)
        if estimated_base_balance is None:
            estimated_total_balance += utils.round_to_cents(amount=account_db.base_balance)
        else:
            estimated_total_balance += estimated_base_balance

    return estimated_total_balance


def _get_estimated_unvalued_spent(
    *, unvalued_spent: list[CurrencyAmount], base_currency_rates: dict[CurrencyCode, Decimal]
) -> Decimal | None:
    if len(unvalued_spent) == 0:
        return None

    estimated_unvalued_spent: Decimal = Decimal("0.00")
    for currency_amount in unvalued_spent:
        estimate: Decimal | None = exchange_rate_service.get_estimate(
            amount=currency_amount.amount, currency=currency_amount.currency, base_currency_rates=base_currency_rates
        )
        if estimate is None:
            return None

        estimated_unvalued_spent += estimate

    return estimated_unvalued_spent


async def get_summary(*, db: AsyncSession, user_id: UUID, month: date | None) -> Summary:
    month_date: date = datetime.now(UTC).date() if month is None else month
    first_day, last_day = _get_month_bounds(month=month_date)

    accounts_db: list[AccountModel] = await account_crud.get_active_money_accounts(db=db, user_id=user_id)
    sums: Row = await transaction_crud.get_income_and_expense_sums(
        db=db, user_id=user_id, date_from=first_day, date_to=last_day
    )

    unvalued_sums: list[Row] = await transaction_crud.get_unvalued_expense_sums(
        db=db, user_id=user_id, date_from=first_day, date_to=last_day
    )

    total_balance: Decimal = _get_total_balance(accounts_db=accounts_db)
    earned: Decimal = utils.round_to_cents(amount=sums.income)
    spent: Decimal = utils.round_to_cents(amount=sums.expense)
    unvalued_spent: list[CurrencyAmount] = [
        CurrencyAmount(currency=unvalued_sum.currency, amount=unvalued_sum.amount) for unvalued_sum in unvalued_sums
    ]
    estimated_base_balances: dict[UUID, Decimal | None] = await account_service.get_estimated_base_balances(
        db=db, accounts_db=accounts_db, user_id=user_id
    )

    if len(unvalued_spent) > 0:
        base_currency_rates: dict[CurrencyCode, Decimal] = await exchange_rate_service.get_base_currency_rates(
            db=db, user_id=user_id
        )
    else:
        base_currency_rates: dict[CurrencyCode, Decimal] = {}

    estimated_total_balance: Decimal | None = _get_estimated_total_balance(
        accounts_db=accounts_db, estimated_base_balances=estimated_base_balances
    )
    estimated_unvalued_spent: Decimal | None = _get_estimated_unvalued_spent(
        unvalued_spent=unvalued_spent, base_currency_rates=base_currency_rates
    )
    summary = Summary(
        month=first_day,
        total_balance=total_balance,
        estimated_total_balance=estimated_total_balance,
        earned=earned,
        spent=spent,
        left_over=earned - spent,
        unvalued_spent=unvalued_spent,
        estimated_unvalued_spent=estimated_unvalued_spent,
    )
    return summary
