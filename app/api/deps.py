from datetime import datetime
from typing import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.db.postgres import SessionLocal
from app.exceptions.unauthorized_401 import SessionExpiredException
from app.schemas.user.session import UserSession
from app.services.user import session_service

logger = get_logger(__name__)


async def get_db() -> AsyncGenerator[AsyncSession]:
    session = SessionLocal()
    try:
        yield session

    finally:
        await session.commit()
        await session.close()


async def get_db_transaction() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal.begin() as session:
        try:
            yield session

        finally:
            await session.commit()
            await session.close()


async def get_user_id(x_auth_token: UUID = Header(...),
                      db: AsyncSession = Depends(get_db)) -> UUID:
    user_session: UserSession = await session_service.get_session_by_token(db=db, token=x_auth_token)
    if user_session.expires_at < datetime.now():
        raise SessionExpiredException(token=x_auth_token, logger=logger)

    return user_session.user_id


def get_token(x_auth_token: UUID = Header(...)) -> UUID:
    return x_auth_token
