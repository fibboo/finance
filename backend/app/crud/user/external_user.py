from uuid import UUID

from sqlalchemy import delete, Delete, select, Select, update, Update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user.external_user import ExternalUser
from app.schemas.user.external_user import ExternalUserCreate, ExternalUserUpdate, ProviderType


class CRUDExternalUser(CRUDBase[ExternalUser, ExternalUserCreate, ExternalUserUpdate]):
    async def get_by_user_for_update(self, *, db: AsyncSession, user_id: UUID) -> list[ExternalUser]:
        query: Select = select(self.model).where(self.model.user_id == user_id).with_for_update()
        external_users: list[ExternalUser] = (await db.scalars(query)).all()
        return external_users

    async def delete_by_user_and_provider(self, *, db: AsyncSession, user_id: UUID, provider: ProviderType) -> None:
        query: Delete = delete(self.model).where(self.model.user_id == user_id, self.model.provider == provider)
        await db.execute(query)
        await db.flush()

    async def move_to_user(self, *, db: AsyncSession, user_id: UUID, new_user_id: UUID) -> None:
        query: Update = update(self.model).where(self.model.user_id == user_id).values(user_id=new_user_id)
        await db.execute(query)
        await db.flush()


external_user_crud = CRUDExternalUser(model=ExternalUser)
