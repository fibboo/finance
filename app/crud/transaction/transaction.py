from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.transaction.transaction import Transaction
from app.schemas.transaction.transaction import (TransactionRequest, OrderDirectionType, OrderFieldType, TransactionCreate,
                                                 TransactionUpdate)


class CRUDTransaction(CRUDBase[Transaction, TransactionCreate, TransactionUpdate]):
    async def get_transactions(self, db: AsyncSession, request: TransactionRequest, user_id: UUID) -> Page[Transaction]:
        query = select(self.model).where(self.model.user_id == user_id)

        if request.amount_from is not None:
            query = query.where(self.model.transaction_amount >= request.amount_from)

        if request.amount_to is not None:
            query = query.where(self.model.transaction_amount <= request.amount_to)

        if request.original_amount_from is not None:
            query = query.where(self.model.original_amount >= request.original_amount_from)

        if request.original_amount_to is not None:
            query = query.where(self.model.original_amount <= request.original_amount_to)

        if len(request.currencies) > 0:
            currencies = [c for c in request.currencies]
            query = query.where(self.model.transaction_currency.in_(currencies))

        if request.date_from is not None:
            query = query.where(self.model.transaction_date >= request.date_from)

        if request.date_to is not None:
            query = query.where(self.model.transaction_date <= request.date_to)

        if len(request.category_ids) > 0:
            query = query.where(self.model.category_id.in_(request.category_ids))

        if len(request.location_ids) > 0:
            query = query.where(self.model.location_id.in_(request.location_ids))

        if len(request.statuses) > 0:
            statuses = [s.value for s in request.statuses]
            query = query.where(self.model.status.in_(statuses))

        order_fields_map = {OrderFieldType.CREATED_AT: self.model.created_at,
                            OrderFieldType.TRANSACTION_DATE: self.model.transaction_date,
                            OrderFieldType.AMOUNT: self.model.transaction_amount}
        for order in request.orders:
            func_ordering = desc if order.ordering == OrderDirectionType.DESC else asc
            query = query.order_by(func_ordering(order_fields_map[order.field]))

        query = query.order_by(self.model.id)

        paginated_expenses = await paginate(db, query, request)
        return paginated_expenses


transaction_crud = CRUDTransaction(Transaction)
