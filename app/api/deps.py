from uuid import UUID

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import SessionLocal
from app.schemas.user.user import User


async def get_db() -> AsyncSession:
    try:
        async with SessionLocal.begin() as session:
            yield session
    finally:
        await session.commit()
        await session.close()


async def get_user_id(x_auth_token: UUID = Header(...)) -> UUID:
    # get user logic here
    user = User(id=x_auth_token)
    return user.id
