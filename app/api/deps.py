from datetime import datetime
from uuid import UUID

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import SessionLocal
from app.exceptions.exception import UnauthorizedException
from app.schemas.user.session import UserSession
from app.services.user import session_service


async def get_db() -> AsyncSession:
    try:
        async with SessionLocal.begin() as session:
            yield session
    finally:
        await session.commit()
        await session.close()


async def get_user_id(x_auth_token: UUID = Header(...)) -> UUID:
    try:
        async with SessionLocal.begin() as db:
            user_session: UserSession = await session_service.get_session_by_token(db=db, token=x_auth_token)
    finally:
        await db.close()

    if user_session.expires_at < datetime.now():
        raise UnauthorizedException(f'Session with token #{x_auth_token} has expired.')

    return user_session.user_id


def get_token(x_auth_token: UUID = Header(...)) -> UUID:
    return x_auth_token
