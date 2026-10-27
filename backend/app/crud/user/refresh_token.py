from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import delete, Delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user.refresh_token import RefreshToken
from app.schemas.user.token import RefreshTokenCreate


class CRUDRefreshToken(CRUDBase[RefreshToken, RefreshTokenCreate, BaseModel]):
    async def get_by_hash(self, *, db: AsyncSession, token_hash: str) -> RefreshToken | None:
        refresh_token: RefreshToken | None = await self.get_or_none(db=db, with_for_update=True, token_hash=token_hash)
        return refresh_token

    async def delete_by_user(self, *, db: AsyncSession, user_id: UUID) -> None:
        query: Delete = delete(self.model).where(self.model.user_id == user_id)
        await db.execute(query)
        await db.flush()


refresh_token_crud = CRUDRefreshToken(model=RefreshToken)
