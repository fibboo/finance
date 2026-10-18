from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import select
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


account_crud = CRUDAccount(model=Account)
