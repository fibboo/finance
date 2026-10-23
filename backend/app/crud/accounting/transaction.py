from datetime import date
from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import asc, ColumnElement, desc, func, Row, select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.base import CRUDBase
from app.models.accounting.account import Account
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.account import MONEY_ACCOUNT_KINDS
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import (
    OrderDirectionType,
    OrderFieldType,
    TransactionCreate,
    TransactionRequest,
    TransactionType,
)
from app.schemas.base import EntityStatusType

logger = get_logger(logger_name=__name__)


class CRUDTransaction(CRUDBase[Transaction, TransactionCreate, TransactionCreate]):
    @staticmethod
    def __get_account_transaction_ids(*, account_ids: list[UUID] | Select) -> Select:
        transaction_ids: Select = select(Posting.transaction_id).where(Posting.account_id.in_(account_ids))
        return transaction_ids

    async def create_with_postings(
        self, *, db: AsyncSession, obj_in: TransactionCreate, postings: list[PostingCreate]
    ) -> Transaction:
        postings_db: list[Posting] = [Posting(**posting.model_dump()) for posting in postings]
        transaction_db: Transaction = self.model(**obj_in.model_dump(), postings=postings_db)
        db.add(transaction_db)
        await db.flush()

        query: Select = (
            select(self.model).where(self.model.id == transaction_db.id).execution_options(populate_existing=True)
        )
        transaction_db: Transaction = (await db.scalars(query)).one()
        return transaction_db

    async def get_transactions(
        self, *, db: AsyncSession, request: TransactionRequest, user_id: UUID
    ) -> Page[Transaction]:

        query: Select = select(Transaction).where(Transaction.user_id == user_id)

        if request.base_currency_amount_from is not None:
            query = query.where(Transaction.base_currency_amount >= request.base_currency_amount_from)

        if request.base_currency_amount_to is not None:
            query = query.where(Transaction.base_currency_amount <= request.base_currency_amount_to)

        if request.date_from is not None:
            query = query.where(Transaction.transaction_date >= request.date_from)

        if request.date_to is not None:
            query = query.where(Transaction.transaction_date <= request.date_to)

        if len(request.transaction_types) > 0:
            transaction_types = [t.value for t in request.transaction_types]
            query = query.where(Transaction.transaction_type.in_(transaction_types))

        if len(request.statuses) > 0:
            statuses = [s.value for s in request.statuses]
            query = query.where(Transaction.status.in_(statuses))

        if len(request.account_ids) > 0:
            transaction_ids: Select = self.__get_account_transaction_ids(account_ids=request.account_ids)
            query = query.where(Transaction.id.in_(transaction_ids))

        if request.is_deleted_accounts_only:
            deleted_account_ids: Select = select(Account.id).where(
                Account.user_id == user_id,
                Account.status == EntityStatusType.DELETED,
                Account.kind.in_(MONEY_ACCOUNT_KINDS),
            )
            transaction_ids: Select = self.__get_account_transaction_ids(account_ids=deleted_account_ids)
            query = query.where(Transaction.id.in_(transaction_ids))

        order_fields_map = {
            OrderFieldType.CREATED_AT: Transaction.created_at,
            OrderFieldType.TRANSACTION_DATE: Transaction.transaction_date,
            OrderFieldType.AMOUNT: Transaction.base_currency_amount,
        }
        for order in request.orders:
            func_ordering = desc if order.ordering == OrderDirectionType.DESC else asc
            query = query.order_by(func_ordering(order_fields_map[order.field]))

        query = query.order_by(Transaction.id)

        paginated_expenses = await apaginate(db, query, request)
        return paginated_expenses

    async def get_income_and_expense_sums(
        self, *, db: AsyncSession, user_id: UUID, date_from: date, date_to: date
    ) -> Row:
        amount: ColumnElement = Transaction.base_currency_amount
        income_sum: ColumnElement = func.sum(amount).filter(Transaction.transaction_type == TransactionType.INCOME)
        expense_sum: ColumnElement = func.sum(amount).filter(Transaction.transaction_type == TransactionType.EXPENSE)
        query: Select = select(
            func.coalesce(income_sum, 0).label("income"), func.coalesce(expense_sum, 0).label("expense")
        ).where(
            Transaction.user_id == user_id,
            Transaction.status == EntityStatusType.ACTIVE,
            Transaction.transaction_date.between(date_from, date_to),
        )
        sums: Row = (await db.execute(query)).one()
        return sums


transaction_crud = CRUDTransaction(model=Transaction)
