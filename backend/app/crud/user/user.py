from uuid import UUID

from sqlalchemy import delete, Delete, func, select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user.external_user import ExternalUser
from app.models.user.user import User
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate, UserUpdate


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_user_by_external_id(
        self, *, db: AsyncSession, external_id: str, provider: ProviderType
    ) -> User | None:
        query = (
            select(User)
            .join(ExternalUser, ExternalUser.user_id == User.id)
            .where(ExternalUser.external_id == external_id)
            .where(ExternalUser.provider == provider.value)
        )

        user: User | None = await db.scalar(query)
        return user

    async def get_user_by_username(self, *, db: AsyncSession, username: str) -> User | None:
        query: Select = select(User).where(func.lower(User.username) == func.lower(username))

        user: User | None = await db.scalar(query)
        return user

    async def get_locked_by_ids(self, *, db: AsyncSession, ids: list[UUID]) -> dict[UUID, User]:
        query: Select = (
            select(self.model)
            .where(self.model.id.in_(ids))
            .order_by(self.model.id)
            .with_for_update(of=self.model)
            .execution_options(populate_existing=True)
        )
        users: list[User] = (await db.execute(query)).unique().scalars().all()
        users_by_id: dict[UUID, User] = {user.id: user for user in users}
        return users_by_id

    async def get_refreshed(self, *, db: AsyncSession, user_id: UUID) -> User:
        query: Select = select(self.model).where(self.model.id == user_id).execution_options(populate_existing=True)
        user: User = (await db.execute(query)).unique().scalar_one()
        return user

    async def delete_by_id(self, *, db: AsyncSession, user_id: UUID) -> None:
        query: Delete = delete(self.model).where(self.model.id == user_id)
        await db.execute(query)
        await db.flush()


user_crud = CRUDUser(model=User)
