from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, case, ColumnElement, func, literal, not_, or_, Row, select, Select, update, Update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.crud.base import CRUDBase
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import EntityStatusType


class CRUDPosting(CRUDBase[Posting, PostingCreate, PostingCreate]):
    async def get_sums_at_date(
        self, *, db: AsyncSession, account_id: UUID, transaction_date: date, transaction_id: UUID | None
    ) -> Row:
        is_later: ColumnElement = Transaction.transaction_date > transaction_date
        is_valued_later: ColumnElement = Transaction.valued_on > transaction_date
        if transaction_id is not None:
            credit_posting: type[Posting] = aliased(self.model)
            credit_transaction: type[Transaction] = aliased(Transaction)
            has_credit_before: ColumnElement = (
                select(credit_posting.id)
                .join(credit_transaction, credit_transaction.id == credit_posting.transaction_id)
                .where(
                    credit_posting.account_id == account_id,
                    credit_posting.amount > 0,
                    credit_transaction.status == EntityStatusType.ACTIVE,
                    credit_transaction.transaction_type != TransactionType.ADJUSTMENT,
                    credit_transaction.transaction_date == transaction_date,
                    credit_transaction.id < transaction_id,
                    or_(Transaction.transaction_date < transaction_date, credit_transaction.id > Transaction.id),
                )
                .exists()
            )
            is_later = or_(
                is_later, and_(Transaction.transaction_date == transaction_date, Transaction.id > transaction_id)
            )
            is_valued_later = or_(
                is_valued_later, and_(Transaction.valued_on == transaction_date, not_(has_credit_before))
            )

        is_waiting: ColumnElement = and_(not_(is_later), or_(self.model.base_amount.is_(None), is_valued_later))
        query: Select = (
            select(
                func.coalesce(func.sum(self.model.amount).filter(is_later), 0).label("later_amount"),
                func.coalesce(func.sum(self.model.base_amount).filter(is_later), 0).label("later_base_amount"),
                func.coalesce(func.sum(self.model.amount).filter(is_waiting), 0).label("waiting_amount"),
                func.coalesce(func.sum(self.model.base_amount).filter(is_waiting), 0).label("waiting_base_amount"),
            )
            .select_from(self.model)
            .join(Transaction, Transaction.id == self.model.transaction_id)
            .where(self.model.account_id == account_id, Transaction.status == EntityStatusType.ACTIVE)
        )
        sums: Row = (await db.execute(query)).one()
        return sums

    async def get_first_revaluable_date(self, *, db: AsyncSession, account_id: UUID, date_from: date) -> date | None:
        query: Select = (
            select(func.min(Transaction.transaction_date))
            .select_from(self.model)
            .join(Transaction, Transaction.id == self.model.transaction_id)
            .where(
                self.model.account_id == account_id,
                or_(self.model.base_amount.is_(None), Transaction.valued_on >= date_from),
                Transaction.status == EntityStatusType.ACTIVE,
            )
        )
        first_revaluable_date: date | None = await db.scalar(query)
        return first_revaluable_date

    async def get_unvalued_sums(self, *, db: AsyncSession, account_ids: list[UUID]) -> list[Row]:
        query: Select = (
            select(self.model.account_id, func.sum(self.model.amount).label("amount"))
            .join(Transaction, Transaction.id == self.model.transaction_id)
            .where(
                self.model.account_id.in_(account_ids),
                self.model.base_amount.is_(None),
                Transaction.status == EntityStatusType.ACTIVE,
            )
            .group_by(self.model.account_id)
        )
        sums: list[Row] = (await db.execute(query)).all()
        return sums

    async def update_amounts(self, *, db: AsyncSession, amounts: dict[UUID, tuple[Decimal, Decimal | None]]) -> None:
        values: list[dict] = [
            {"id": posting_id, "amount": amount, "base_amount": base_amount}
            for posting_id, (amount, base_amount) in amounts.items()
        ]
        await db.execute(update(self.model), values)
        await db.flush()

    async def update_account_ids(self, *, db: AsyncSession, account_ids: dict[UUID, UUID]) -> None:
        if len(account_ids) == 0:
            return

        new_account_ids: dict[UUID, ColumnElement] = {
            account_id: literal(new_account_id, self.model.account_id.type)
            for account_id, new_account_id in account_ids.items()
        }
        query: Update = (
            update(self.model)
            .where(self.model.account_id.in_(account_ids.keys()))
            .values(account_id=case(new_account_ids, value=self.model.account_id))
        )
        await db.execute(query)
        await db.flush()


posting_crud = CRUDPosting(model=Posting)
