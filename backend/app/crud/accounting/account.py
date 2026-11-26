from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import case, func, or_, select, Select, Subquery, update, Update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.account import Account
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.account import (
    AccountCreate,
    AccountKind,
    AccountRequest,
    AccountUpdate,
    CategoryPurpose,
    MONEY_ACCOUNT_KINDS,
)
from app.schemas.base import EntityStatusType, ListOrderType


class CRUDAccount(CRUDBase[Account, AccountCreate, AccountUpdate]):
    async def get_accounts(
        self, *, db: AsyncSession, request: AccountRequest, user_id: UUID, recent_use_dates: tuple[date, date]
    ) -> Page[Account]:
        query: Select = select(self.model).where(
            self.model.user_id == user_id,
            self.model.status.in_(request.statuses),
            self.model.kind.in_(request.kinds),
        )

        if len(request.category_types) > 0:
            query = query.where(self.model.category_type.in_(request.category_types))

        if len(request.classification_ids) > 0:
            query = query.where(self.model.classification_id.in_(request.classification_ids))

        if len(request.category_purposes) > 0:
            query = query.where(
                self.model.kind == AccountKind.EXPENSE,
                func.coalesce(self.model.category_purpose, CategoryPurpose.PERSONAL).in_(request.category_purposes),
            )

        if request.search_term is not None:
            query = query.where(
                or_(
                    self.model.name.icontains(request.search_term, autoescape=True),
                    self.model.description.icontains(request.search_term, autoescape=True),
                )
            )

        if request.order == ListOrderType.RECENT_USE:
            recent_use_start, recent_use_end = recent_use_dates
            use_counts: Subquery = (
                select(Posting.account_id, func.count(func.distinct(Posting.transaction_id)).label("use_count"))
                .join(Transaction, Transaction.id == Posting.transaction_id)
                .where(
                    Transaction.user_id == user_id,
                    Transaction.status == EntityStatusType.ACTIVE,
                    Transaction.transaction_date.between(recent_use_start, recent_use_end),
                )
                .group_by(Posting.account_id)
                .subquery()
            )
            query = query.outerjoin(use_counts, use_counts.c.account_id == self.model.id).order_by(
                func.coalesce(use_counts.c.use_count, 0).desc()
            )

        query = query.order_by(self.model.name, self.model.id)
        paginated_accounts = await apaginate(db, query, request)
        return paginated_accounts

    async def get_active_money_accounts(self, *, db: AsyncSession, user_id: UUID) -> list[Account]:
        query: Select = select(self.model).where(
            self.model.user_id == user_id,
            self.model.status == EntityStatusType.ACTIVE,
            self.model.kind.in_(MONEY_ACCOUNT_KINDS),
        )
        accounts: list[Account] = (await db.scalars(query)).all()
        return accounts

    async def count_active_money_accounts(self, *, db: AsyncSession, user_id: UUID) -> int:
        query: Select = select(func.count(self.model.id)).where(
            self.model.user_id == user_id,
            self.model.status == EntityStatusType.ACTIVE,
            self.model.kind.in_(MONEY_ACCOUNT_KINDS),
        )
        accounts_count: int = await db.scalar(query)
        return accounts_count

    async def get_locked_active_money_accounts(self, *, db: AsyncSession, user_id: UUID) -> dict[UUID, Account]:
        query: Select = (
            self._build_get_query(with_for_update=True, user_id=user_id, status=EntityStatusType.ACTIVE)
            .where(self.model.kind.in_(MONEY_ACCOUNT_KINDS))
            .order_by(self.model.id)
            .execution_options(populate_existing=True)
        )
        accounts: list[Account] = (await db.scalars(query)).all()
        accounts_by_id: dict[UUID, Account] = {account.id: account for account in accounts}
        return accounts_by_id

    async def lock_money_accounts(self, *, db: AsyncSession, user_id: UUID) -> None:
        query: Select = (
            select(self.model.id)
            .where(self.model.user_id == user_id, self.model.kind.in_(MONEY_ACCOUNT_KINDS))
            .order_by(self.model.id)
            .with_for_update()
        )
        await db.execute(query)

    async def get_locked_by_ids(self, *, db: AsyncSession, ids: list[UUID], **kwargs) -> dict[UUID, Account]:
        query: Select = (
            self._build_get_query(with_for_update=True, **kwargs)
            .where(self.model.id.in_(ids))
            .order_by(self.model.id)
            .execution_options(populate_existing=True)
        )
        accounts: list[Account] = (await db.scalars(query)).all()
        accounts_by_id: dict[UUID, Account] = {account.id: account for account in accounts}
        return accounts_by_id

    async def add_to_balance(
        self, *, db: AsyncSession, account_id: UUID, amount: Decimal, base_amount: Decimal
    ) -> None:
        query: Update = (
            update(self.model)
            .where(self.model.id == account_id)
            .values(balance=self.model.balance + amount, base_balance=self.model.base_balance + base_amount)
        )
        await db.execute(query)
        await db.flush()

    async def get_user_accounts(self, *, db: AsyncSession, user_id: UUID) -> list[Account]:
        query: Select = select(self.model).where(self.model.user_id == user_id).order_by(self.model.id)
        accounts: list[Account] = (await db.scalars(query)).all()
        return accounts

    async def update_names(self, *, db: AsyncSession, names: dict[UUID, str]) -> None:
        if len(names) == 0:
            return

        values: list[dict] = [{"id": account_id, "name": name} for account_id, name in names.items()]
        await db.execute(update(self.model), values)
        await db.flush()

    async def has_classification_assignments(self, *, db: AsyncSession, classification_id: UUID) -> bool:
        query: Select = select(select(self.model.id).where(self.model.classification_id == classification_id).exists())
        has_assignments: bool = await db.scalar(query)
        return has_assignments

    async def replace_classification(self, *, db: AsyncSession, classification_id: UUID, replacement_id: UUID) -> None:
        query: Update = (
            update(self.model)
            .where(self.model.classification_id == classification_id)
            .values(classification_id=replacement_id)
        )
        await db.execute(query)
        await db.flush()

    async def move_with_classifications(
        self, *, db: AsyncSession, user_id: UUID, new_user_id: UUID, classification_ids: dict[UUID, UUID]
    ) -> None:
        query: Update = update(self.model).where(self.model.user_id == user_id).values(user_id=new_user_id)
        if len(classification_ids) > 0:
            query = query.values(
                classification_id=case(
                    classification_ids, value=self.model.classification_id, else_=self.model.classification_id
                )
            )

        await db.execute(query)
        await db.flush()


account_crud = CRUDAccount(model=Account)
