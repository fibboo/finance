from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, func, Row, select, Select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.posting import PostingCreate
from app.schemas.base import EntityStatusType


class CRUDPosting(CRUDBase[Posting, PostingCreate, PostingCreate]):
    async def get_sums_after_date(self, *, db: AsyncSession, account_id: UUID, transaction_date: date) -> Row:
        query: Select = (
            select(
                func.coalesce(func.sum(self.model.amount), 0).label("amount"),
                func.coalesce(func.sum(self.model.base_amount), 0).label("base_amount"),
            )
            .join(Transaction, Transaction.id == self.model.transaction_id)
            .where(
                self.model.account_id == account_id,
                Transaction.status == EntityStatusType.ACTIVE,
                Transaction.transaction_date > transaction_date,
            )
        )
        sums: Row = (await db.execute(query)).one()
        return sums

    async def get_first_unvalued_date(self, *, db: AsyncSession, account_id: UUID) -> date | None:
        query: Select = (
            select(func.min(Transaction.transaction_date))
            .select_from(self.model)
            .join(Transaction, Transaction.id == self.model.transaction_id)
            .where(
                self.model.account_id == account_id,
                self.model.base_amount.is_(None),
                Transaction.status == EntityStatusType.ACTIVE,
            )
        )
        first_unvalued_date: date | None = await db.scalar(query)
        return first_unvalued_date

    async def update_amounts(self, *, db: AsyncSession, amounts: dict[UUID, tuple[Decimal, Decimal]]) -> None:
        values: list[dict] = [
            {"id": posting_id, "amount": amount, "base_amount": base_amount}
            for posting_id, (amount, base_amount) in amounts.items()
        ]
        await db.execute(update(self.model), values)
        await db.flush()

    async def delete_by_ids(self, *, db: AsyncSession, ids: list[UUID]) -> None:
        await db.execute(delete(self.model).where(self.model.id.in_(ids)))
        await db.flush()


posting_crud = CRUDPosting(model=Posting)
