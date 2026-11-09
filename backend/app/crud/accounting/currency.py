from datetime import date
from uuid import UUID

from sqlalchemy import func, select, Select, Subquery
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.currency import Currency
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.currency import Currency as CurrencySchema
from app.schemas.base import EntityStatusType


class CRUDCurrency(CRUDBase[Currency, CurrencySchema, CurrencySchema]):
    async def get_currencies(self, *, db: AsyncSession) -> list[Currency]:
        query: Select = select(self.model).order_by(self.model.position)
        currencies: list[Currency] = (await db.scalars(query)).all()
        return currencies

    async def get_currencies_by_recent_use(
        self, *, db: AsyncSession, user_id: UUID, recent_use_dates: tuple[date, date]
    ) -> list[Currency]:
        recent_use_start, recent_use_end = recent_use_dates
        use_counts: Subquery = (
            select(Posting.currency, func.count(func.distinct(Posting.transaction_id)).label("use_count"))
            .join(Transaction, Transaction.id == Posting.transaction_id)
            .where(
                Transaction.user_id == user_id,
                Transaction.status == EntityStatusType.ACTIVE,
                Transaction.transaction_date.between(recent_use_start, recent_use_end),
            )
            .group_by(Posting.currency)
            .subquery()
        )
        query: Select = (
            select(self.model)
            .outerjoin(use_counts, use_counts.c.currency == self.model.code)
            .order_by(func.coalesce(use_counts.c.use_count, 0).desc(), self.model.position)
        )
        currencies: list[Currency] = (await db.scalars(query)).all()
        return currencies


currency_crud = CRUDCurrency(model=Currency)
