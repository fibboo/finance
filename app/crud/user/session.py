from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models import UserSession
from app.schemas.user.session import UserSessionCreate, UserSessionUpdate


class CRUDUserSession(CRUDBase[UserSession, UserSessionCreate, UserSessionUpdate]):
    async def get_active_sessions(self, db: AsyncSession, user_id: UUID, date: datetime) -> list[UserSession]:
        query = (select(self.model)
                 .where(self.model.user_id == user_id)
                 .where(self.model.expires_at <= date))

        sessions: list[UserSession] = (await db.scalars(query)).all()
        return sessions

    async def revoke(self,
                     db: AsyncSession,
                     id: UUID,
                     flush: Optional[bool] = True,
                     commit: Optional[bool] = False) -> None:
        query = update(self.model).where(self.model.id == id).values(expires_at=datetime.now())
        await db.execute(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()


user_session_crud = CRUDUserSession(UserSession)
