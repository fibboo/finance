from datetime import date, datetime
from decimal import Decimal
from typing import Any, NamedTuple
from uuid import UUID

from sqlalchemy import case, column, Date, func, insert, literal, Numeric, select, Select, String, update, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.crud.base import CRUDBase
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.models.accounting.transaction_import import OPEN_IMPORT_STATUSES, TransactionImport, TransactionImportRow
from app.schemas.accounting.transaction import TransactionType
from app.schemas.accounting.transaction_import import (
    TransactionImport as ImportSchema,
    TransactionImportRow as ImportRowSchema,
)
from app.schemas.base import EntityStatusType


class ImportTransactionKey(NamedTuple):
    transaction_type: TransactionType
    transaction_date: date
    from_id: UUID
    to_id: UUID | None
    amount: Decimal


class CRUDTransactionImport(CRUDBase[TransactionImport, ImportSchema, ImportSchema]):
    async def get_open(
        self, *, db: AsyncSession, user_id: UUID, with_for_update: bool = False
    ) -> TransactionImport | None:
        query: Select = select(self.model).where(
            self.model.user_id == user_id, self.model.status.in_(OPEN_IMPORT_STATUSES)
        )
        if with_for_update:
            query = query.with_for_update()

        result: TransactionImport | None = await db.scalar(query)
        return result

    async def get_last_applied_at(self, *, db: AsyncSession, user_id: UUID, file_hash: str) -> datetime | None:
        query: Select = select(func.max(self.model.updated_at)).where(
            self.model.user_id == user_id, self.model.file_hash == file_hash, self.model.status == "APPLIED"
        )
        applied_at: datetime | None = await db.scalar(query)
        return applied_at


class CRUDTransactionImportRow(CRUDBase[TransactionImportRow, ImportRowSchema, ImportRowSchema]):
    async def insert_rows(self, *, db: AsyncSession, rows: list[dict[str, Any]]) -> None:
        if len(rows) > 0:
            await db.execute(insert(self.model), rows)

    async def get_rows(self, *, db: AsyncSession, import_id: UUID) -> list[TransactionImportRow]:
        query: Select = select(self.model).where(self.model.import_id == import_id).order_by(self.model.row_number)
        rows: list[TransactionImportRow] = list(await db.scalars(query))
        return rows

    async def update_reviews(self, *, db: AsyncSession, reviews: list[dict[str, Any]]) -> None:
        if len(reviews) > 0:
            await db.execute(update(self.model), reviews)
            await db.flush()

    async def find_duplicate_transactions(
        self, *, db: AsyncSession, user_id: UUID, keys: set[ImportTransactionKey], equity_ids: list[UUID]
    ) -> dict[ImportTransactionKey, UUID]:
        if len(keys) == 0:
            return {}

        records: list[dict[str, str | None]] = [
            {
                "kind": key.transaction_type,
                "day": key.transaction_date.isoformat(),
                "from_id": str(key.from_id),
                "to_id": str(key.to_id) if key.to_id is not None else None,
                "amount": str(key.amount),
            }
            for key in keys
        ]
        imported = (
            func.jsonb_to_recordset(literal(records, type_=JSONB))
            .table_valued(
                column("kind", String),
                column("day", Date),
                column("from_id", Uuid),
                column("to_id", Uuid),
                column("amount", Numeric),
            )
            .render_derived(name="imported", with_types=True)
        )
        debit = aliased(Posting)
        credit = aliased(Posting)
        is_adjustment = Transaction.transaction_type == TransactionType.ADJUSTMENT
        is_credit_adjustment = is_adjustment & debit.account_id.in_(equity_ids)
        from_id = case((is_credit_adjustment, credit.account_id), else_=debit.account_id)
        to_id = case((is_adjustment, None), else_=credit.account_id)
        amount = case((is_credit_adjustment, credit.amount), (is_adjustment, debit.amount), else_=-debit.amount)
        query: Select = (
            select(
                Transaction.transaction_type,
                Transaction.transaction_date,
                imported.c.from_id,
                imported.c.to_id,
                imported.c.amount,
                Transaction.id,
            )
            .select_from(imported)
            .join(
                Transaction,
                (Transaction.transaction_type == imported.c.kind) & (Transaction.transaction_date == imported.c.day),
            )
            .join(debit, (debit.transaction_id == Transaction.id) & (debit.amount < 0))
            .join(credit, (credit.transaction_id == Transaction.id) & (credit.amount > 0))
            .where(
                Transaction.user_id == user_id,
                Transaction.status == EntityStatusType.ACTIVE,
                from_id == imported.c.from_id,
                to_id.is_not_distinct_from(imported.c.to_id),
                amount == imported.c.amount,
            )
            .order_by(Transaction.id.desc())
        )
        matches: dict[ImportTransactionKey, UUID] = {
            ImportTransactionKey(kind, day, from_id, to_id, amount): transaction_id
            for kind, day, from_id, to_id, amount, transaction_id in await db.execute(query)
        }
        return matches


transaction_import_crud = CRUDTransactionImport(model=TransactionImport)
transaction_import_row_crud = CRUDTransactionImportRow(model=TransactionImportRow)
