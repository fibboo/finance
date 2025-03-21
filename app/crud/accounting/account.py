from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import count

from app.crud.base import CRUDBase
from app.models.accounting.account import Account
from app.schemas.accounting.account import AccountCreate, AccountUpdate


class CRUDAccount(CRUDBase[Account, AccountCreate, AccountUpdate]):
    async def count(self, db: AsyncSession, user_id: UUID) -> int:
        query: Select = select(count(self.model.id)).where(self.model.user_id == user_id)
        result: int = (await db.execute(query)).scalar()
        return result


account_crud = CRUDAccount(Account)
