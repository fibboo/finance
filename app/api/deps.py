from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.db.postgres import session_maker
from app.exceptions.unauthorized_401 import SessionExpiredException
from app.models.user.session import Session as SessionModel

logger = get_logger(__name__)


async def get_db() -> AsyncSession:
    try:
        async with session_maker() as session:
            yield session

    finally:
        await session.commit()
        await session.close()


async def get_db_transaction() -> AsyncSession:
    try:
        async with session_maker.begin() as session:
            yield session

    finally:
        await session.commit()
        await session.close()


async def get_user_id(x_auth_token: UUID = Header(...),
                      db: AsyncSession = Depends(get_db), session_crud=None) -> UUID:
    session_db: SessionModel | None = await session_crud.get_active_session(db=db, session_id=x_auth_token)
    if session_db is None:
        raise SessionExpiredException(token=x_auth_token, logger=logger)

    return session_db.user_id


def get_token(x_auth_token: UUID = Header(...)) -> UUID:
    return x_auth_token
