from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.account import Account
from app.schemas.accounting.account import AccountCreate, AccountRequest, AccountUpdate
from app.schemas.base import EntityStatusType


class CRUDAccount(CRUDBase[Account, AccountCreate, AccountUpdate]):
    async def get_accounts(self, *, db: AsyncSession, request: AccountRequest, user_id: UUID) -> Page[Account]:
        query = (
            select(self.model)
            .where(self.model.user_id == user_id, self.model.status == EntityStatusType.ACTIVE)
            .order_by(self.model.name)
            .order_by(self.model.id)
        )

        paginated_accounts = await apaginate(db, query, request)
        return paginated_accounts

    async def get_active_accounts(self, *, db: AsyncSession, user_id: UUID) -> list[Account]:
        query: Select = select(self.model).where(
            self.model.user_id == user_id, self.model.status == EntityStatusType.ACTIVE
        )
        accounts: list[Account] = (await db.scalars(query)).all()
        return accounts

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


account_crud = CRUDAccount(model=Account)
