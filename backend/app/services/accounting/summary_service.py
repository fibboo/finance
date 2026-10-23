import calendar
from datetime import date, datetime, UTC
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import transaction_crud
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.summary import Summary
from app.utils import utils


def _get_month_bounds(*, month: date) -> tuple[date, date]:
    days_in_month: int = calendar.monthrange(month.year, month.month)[1]
    month_bounds: tuple[date, date] = (month.replace(day=1), month.replace(day=days_in_month))
    return month_bounds


def _get_total_balance(*, accounts_db: list[AccountModel]) -> Decimal:
    total_balance: Decimal = Decimal("0.00")
    for account_db in accounts_db:
        total_balance += utils.get_base_currency_balance(
            balance=account_db.balance, base_currency_rate=account_db.base_currency_rate
        )

    return total_balance


async def get_summary(*, db: AsyncSession, user_id: UUID, month: date | None) -> Summary:
    month_date: date = datetime.now(UTC).date() if month is None else month
    first_day, last_day = _get_month_bounds(month=month_date)

    accounts_db: list[AccountModel] = await account_crud.get_active_money_accounts(db=db, user_id=user_id)
    sums: Row = await transaction_crud.get_income_and_expense_sums(
        db=db, user_id=user_id, date_from=first_day, date_to=last_day
    )

    total_balance: Decimal = _get_total_balance(accounts_db=accounts_db)
    earned: Decimal = utils.round_to_cents(amount=sums.income)
    spent: Decimal = utils.round_to_cents(amount=sums.expense)
    summary = Summary(
        month=first_day, total_balance=total_balance, earned=earned, spent=spent, left_over=earned - spent
    )
    return summary
