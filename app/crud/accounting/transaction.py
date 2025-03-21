from typing import Any
from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import asc, desc, select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.base import CRUDBase, Model, UpdateSchema
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.transaction import (OrderDirectionType, OrderFieldType, TransactionCreate,
                                                TransactionCreateRequest)

logger = get_logger(__name__)


class CRUDTransaction(CRUDBase[Transaction, TransactionCreate, TransactionCreate]):
    async def get_transactions(self,
                               db: AsyncSession,
                               request: TransactionCreateRequest,
                               user_id: UUID) -> Page[Transaction]:
        query: Select = select(self.model).where(self.model.user_id == user_id)

        if request.base_currency_amount_from is not None:
            query = query.where(self.model.base_currency_amount >= request.base_currency_amount_from)

        if request.base_currency_amount_to is not None:
            query = query.where(self.model.base_currency_amount <= request.base_currency_amount_to)

        if len(request.currencies) > 0:
            currencies = [c.value for c in request.currencies]
            query = query.where(self.model.transaction_currency.in_(currencies))

        if request.date_from is not None:
            query = query.where(self.model.transaction_date >= request.date_from)

        if request.date_to is not None:
            query = query.where(self.model.transaction_date <= request.date_to)

        if len(request.category_ids) > 0:
            query = query.where(self.model.category_id.in_(request.category_ids))

        if len(request.location_ids) > 0:
            query = query.where(self.model.location_id.in_(request.location_ids))

        if len(request.transaction_types) > 0:
            transaction_types = [t.value for t in request.transaction_types]
            query = query.where(self.model.transaction_type.in_(transaction_types))

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

    async def update(self,
                     db: AsyncSession,
                     obj_in: UpdateSchema | dict[str, Any],
                     flush: bool | None = True,
                     commit: bool | None = False,
                     **kwargs) -> Model | None:
        raise NotImplementedException(log_message='Transaction update crud is not implemented.', logger=logger)


transaction_crud = CRUDTransaction(Transaction)
