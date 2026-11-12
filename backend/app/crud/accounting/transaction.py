from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import asc, case, ColumnElement, desc, false, func, literal, Row, select, Select, update, Update
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.base import CRUDBase
from app.models.accounting.account import Account
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import ENTRY_ORDER_SEQUENCE, Transaction
from app.schemas.accounting.account import AccountKind, MONEY_ACCOUNT_KINDS
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

        transaction_db: Transaction = await self.get_refreshed(db=db, transaction_id=transaction_db.id)
        return transaction_db

    async def update_with_postings(
        self, *, db: AsyncSession, db_obj: Transaction, obj_in: TransactionCreate, postings: list[PostingCreate]
    ) -> Transaction:
        for field, value in obj_in.model_dump().items():
            setattr(db_obj, field, value)

        db_obj.entry_order = ENTRY_ORDER_SEQUENCE.next_value()

        postings_db: list[Posting] = [Posting(**posting.model_dump(), transaction_id=db_obj.id) for posting in postings]
        db.add_all(postings_db)
        await db.flush()

        transaction_db: Transaction = await self.get_refreshed(db=db, transaction_id=db_obj.id)
        return transaction_db

    async def get_refreshed(self, *, db: AsyncSession, transaction_id: UUID) -> Transaction:
        query: Select = (
            select(self.model).where(self.model.id == transaction_id).execution_options(populate_existing=True)
        )
        transaction_db: Transaction = (await db.scalars(query)).one()
        return transaction_db

    async def get_account_transactions_from_date(
        self, *, db: AsyncSession, account_id: UUID, date_from: date
    ) -> list[Transaction]:
        transaction_ids: Select = self.__get_account_transaction_ids(account_ids=[account_id])
        query: Select = (
            select(self.model)
            .where(
                self.model.id.in_(transaction_ids),
                self.model.status == EntityStatusType.ACTIVE,
                self.model.transaction_date >= date_from,
            )
            .order_by(self.model.transaction_date, self.model.entry_order)
            .execution_options(populate_existing=True)
        )
        transactions_db: list[Transaction] = (await db.scalars(query)).all()
        return transactions_db

    async def update_base_currency_amounts(self, *, db: AsyncSession, amounts: dict[UUID, Decimal | None]) -> None:
        values: list[dict] = [
            {"id": transaction_id, "base_currency_amount": amount} for transaction_id, amount in amounts.items()
        ]
        await db.execute(update(self.model), values)
        await db.flush()

    async def update_valued_dates(self, *, db: AsyncSession, valued_dates: dict[UUID, date | None]) -> None:
        values: list[dict] = [
            {"id": transaction_id, "valued_on": valued_on} for transaction_id, valued_on in valued_dates.items()
        ]
        await db.execute(update(self.model), values)
        await db.flush()

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
            accounts_query: Select = select(Account.id, Account.kind).where(
                Account.user_id == user_id, Account.id.in_(request.account_ids)
            )
            accounts: Sequence[Row] = (await db.execute(accounts_query)).all()
            account_ids_by_kind: dict[AccountKind, list[UUID]] = {}
            for account_id, kind in accounts:
                filter_kind: AccountKind = AccountKind.ASSET if kind in MONEY_ACCOUNT_KINDS else kind
                account_ids_by_kind.setdefault(filter_kind, []).append(account_id)

            if len(accounts) < len(set(request.account_ids)):
                query = query.where(false())

            for kind_account_ids in account_ids_by_kind.values():
                transaction_ids: Select = self.__get_account_transaction_ids(account_ids=kind_account_ids)
                query = query.where(Transaction.id.in_(transaction_ids))

        if request.is_deleted_accounts_only:
            deleted_account_ids: Select = select(Account.id).where(
                Account.user_id == user_id,
                Account.status == EntityStatusType.DELETED,
                Account.kind.in_(MONEY_ACCOUNT_KINDS),
            )
            transaction_ids: Select = self.__get_account_transaction_ids(account_ids=deleted_account_ids)
            query = query.where(Transaction.id.in_(transaction_ids))

        if len(request.location_ids) > 0:
            query = query.where(Transaction.location_id.in_(request.location_ids))

        order_fields_map = {
            OrderFieldType.CREATED_AT: Transaction.created_at,
            OrderFieldType.TRANSACTION_DATE: Transaction.transaction_date,
            OrderFieldType.AMOUNT: Transaction.base_currency_amount,
        }
        for order in request.orders:
            func_ordering = desc if order.ordering == OrderDirectionType.DESC else asc
            query = query.order_by(func_ordering(order_fields_map[order.field]).nulls_last())

        is_descending: bool = len(request.orders) > 0 and request.orders[0].ordering == OrderDirectionType.DESC
        query = query.order_by(desc(Transaction.entry_order) if is_descending else asc(Transaction.entry_order))

        paginated_expenses = await apaginate(db, query, request)
        return paginated_expenses

    async def count_active_transactions(self, *, db: AsyncSession, user_id: UUID) -> int:
        query: Select = select(func.count(self.model.id)).where(
            self.model.user_id == user_id, self.model.status == EntityStatusType.ACTIVE
        )
        transactions_count: int = await db.scalar(query)
        return transactions_count

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

    async def get_unvalued_expense_sums(
        self, *, db: AsyncSession, user_id: UUID, date_from: date, date_to: date
    ) -> list[Row]:
        query: Select = (
            select(Posting.currency, func.sum(-Posting.amount).label("amount"))
            .join(Transaction, Transaction.id == Posting.transaction_id)
            .where(
                Transaction.user_id == user_id,
                Transaction.status == EntityStatusType.ACTIVE,
                Transaction.transaction_type == TransactionType.EXPENSE,
                Transaction.base_currency_amount.is_(None),
                Transaction.transaction_date.between(date_from, date_to),
                Posting.amount < 0,
            )
            .group_by(Posting.currency)
            .order_by(Posting.currency)
        )
        sums: list[Row] = (await db.execute(query)).all()
        return sums

    async def update_location_ids(self, *, db: AsyncSession, location_ids: dict[UUID, UUID]) -> None:
        if len(location_ids) == 0:
            return

        new_location_ids: dict[UUID, ColumnElement] = {
            location_id: literal(new_location_id, self.model.location_id.type)
            for location_id, new_location_id in location_ids.items()
        }
        query: Update = (
            update(self.model)
            .where(self.model.location_id.in_(location_ids.keys()))
            .values(location_id=case(new_location_ids, value=self.model.location_id))
        )
        await db.execute(query)
        await db.flush()


transaction_crud = CRUDTransaction(model=Transaction)
