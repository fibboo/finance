from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import asc, desc, select, Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, with_polymorphic

from app.configs.logging_settings import get_logger
from app.crud.base import CRUDBase
from app.models.accounting.transaction import ExpenseTransaction, IncomeTransaction, Transaction, TransferTransaction
from app.schemas.accounting.transaction import (OrderDirectionType, OrderFieldType, TransactionCreate,
                                                TransactionRequest)

logger = get_logger(__name__)

TransactionModel = with_polymorphic(Transaction, [ExpenseTransaction, IncomeTransaction, TransferTransaction])


class CRUDTransaction(CRUDBase[TransactionModel, TransactionCreate, TransactionCreate]):
    def _get_polymorphic_query(self, query: Select) -> Select:
        query: Select = query.options(selectinload(TransactionModel.ExpenseTransaction.from_account),
                                      selectinload(TransactionModel.ExpenseTransaction.category),
                                      selectinload(TransactionModel.ExpenseTransaction.location),
                                      selectinload(TransactionModel.IncomeTransaction.to_account),
                                      selectinload(TransactionModel.IncomeTransaction.income_source),
                                      selectinload(TransactionModel.TransferTransaction.from_account),
                                      selectinload(TransactionModel.TransferTransaction.to_account))
        return query

    async def get_transactions(self,
                               db: AsyncSession,
                               request: TransactionRequest,
                               user_id: UUID) -> Page[Transaction]:

        query: Select = select(TransactionModel).where(TransactionModel.user_id == user_id)
        query = self._get_polymorphic_query(query)

        if request.base_currency_amount_from is not None:
            query = query.where(TransactionModel.base_currency_amount >= request.base_currency_amount_from)

        if request.base_currency_amount_to is not None:
            query = query.where(TransactionModel.base_currency_amount <= request.base_currency_amount_to)

        if request.date_from is not None:
            query = query.where(TransactionModel.transaction_date >= request.date_from)

        if request.date_to is not None:
            query = query.where(TransactionModel.transaction_date <= request.date_to)

        if len(request.transaction_types) > 0:
            transaction_types = [t.value for t in request.transaction_types]
            query = query.where(TransactionModel.transaction_type.in_(transaction_types))

        if len(request.statuses) > 0:
            statuses = [s.value for s in request.statuses]
            query = query.where(TransactionModel.status.in_(statuses))

        order_fields_map = {OrderFieldType.CREATED_AT: TransactionModel.created_at,
                            OrderFieldType.TRANSACTION_DATE: TransactionModel.transaction_date,
                            OrderFieldType.AMOUNT: TransactionModel.base_currency_amount}
        for order in request.orders:
            func_ordering = desc if order.ordering == OrderDirectionType.DESC else asc
            query = query.order_by(func_ordering(order_fields_map[order.field]))

        query = query.order_by(TransactionModel.id)

        paginated_expenses = await paginate(db, query, request)
        return paginated_expenses

    def _build_get_query(self, with_for_update: bool = False, **kwargs) -> Select:
        query: Select = select(TransactionModel).where(*[getattr(TransactionModel, k) == v for k, v in kwargs.items()])
        query = self._get_polymorphic_query(query)

        if with_for_update:
            query = query.with_for_update()

        return query


transaction_crud = CRUDTransaction(Transaction)

Expense = with_polymorphic(Transaction, [ExpenseTransaction])


class CRUDExpenseTransaction(CRUDBase[Expense, TransactionCreate, TransactionCreate]):
    pass


expense_transaction_crud = CRUDExpenseTransaction(ExpenseTransaction)

Income = with_polymorphic(Transaction, [IncomeTransaction])


class CRUDIncomeTransaction(CRUDBase[Income, TransactionCreate, TransactionCreate]):
    pass


income_transaction_crud = CRUDIncomeTransaction(IncomeTransaction)

Transfer = with_polymorphic(Transaction, [TransferTransaction])


class CRUDTransferTransaction(CRUDBase[Transfer, TransactionCreate, TransactionCreate]):
    pass


transfer_transaction_crud = CRUDTransferTransaction(TransferTransaction)
