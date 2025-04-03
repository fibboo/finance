from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user.session import Session
from app.schemas.user.session import UserSessionCreate, UserSessionUpdate


class CRUDUserSession(CRUDBase[Session, UserSessionCreate, UserSessionUpdate]):
    async def get_active_session(self, db: AsyncSession, user_id: UUID) -> Session | None:
        query = (select(self.model)
                 .where(self.model.user_id == user_id)
                 .where(self.model.expires_at >= datetime.now()))

        session: Session | None = await db.scalar(query)
        return session

    async def revoke(self,
                     db: AsyncSession,
                     id: UUID,  # noqa: A002
                     flush: bool | None = True,
                     commit: bool | None = False) -> None:
        query = update(self.model).where(self.model.id == id).values(expires_at=datetime.now())
        await db.execute(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()


user_session_crud = CRUDUserSession(Session)
