from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import func, insert, select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.transaction_import import OPEN_IMPORT_STATUSES, TransactionImport, TransactionImportRow
from app.schemas.accounting.transaction_import import (
    TransactionImport as ImportSchema,
    TransactionImportRow as ImportRowSchema,
    TransactionImportRowsRequest,
)


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

    async def get_counts(self, *, db: AsyncSession, import_id: UUID) -> tuple[int, int]:
        query: Select = select(func.count(), func.count().filter(func.jsonb_array_length(self.model.errors) > 0)).where(
            self.model.import_id == import_id
        )
        row_count, error_row_count = (await db.execute(query)).one()
        counts: tuple[int, int] = (row_count, error_row_count)
        return counts

    async def get_page(
        self, *, db: AsyncSession, import_id: UUID, request: TransactionImportRowsRequest
    ) -> Page[TransactionImportRow]:
        query: Select = select(self.model).where(self.model.import_id == import_id).order_by(self.model.row_number)
        if request.has_errors is not None:
            query = query.where((func.jsonb_array_length(self.model.errors) > 0) == request.has_errors)

        page: Page[TransactionImportRow] = await apaginate(db, query, request)
        return page

    async def get_error_rows(self, *, db: AsyncSession, import_id: UUID) -> list[TransactionImportRow]:
        query: Select = (
            select(self.model)
            .where(self.model.import_id == import_id, func.jsonb_array_length(self.model.errors) > 0)
            .order_by(self.model.row_number)
        )
        rows: list[TransactionImportRow] = (await db.scalars(query)).all()
        return rows


transaction_import_crud = CRUDTransactionImport(model=TransactionImport)
transaction_import_row_crud = CRUDTransactionImportRow(model=TransactionImportRow)
