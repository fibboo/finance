from uuid import UUID

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import SessionLocal


async def get_db() -> AsyncSession:
    try:
        async with SessionLocal.begin() as session:
            yield session
    finally:
        await session.commit()
        await session.close()


def get_user_id(user_id: UUID = Header(...)) -> UUID:
    return user_id


def get_token(x_auth_token: UUID = Header(...)) -> UUID:
    return x_auth_token
