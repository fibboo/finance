from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user.external_user import ExternalUser
from app.models.user.user import User
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate, UserUpdate


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_user_by_external_id(self,
                                      db: AsyncSession,
                                      external_id: str,
                                      provider: ProviderType) -> Optional[User]:
        query = (select(User)
                 .join(ExternalUser, ExternalUser.user_id == User.id)
                 .where(ExternalUser.external_id == external_id)
                 .where(ExternalUser.provider == provider.value))

        user: Optional[User] = await db.scalar(query)
        return user


user_crud = CRUDUser(User)
