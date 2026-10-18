from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.db.postgres import session_maker
from app.exceptions.unauthorized_401 import InvalidTokenException, RefreshTokenReusedException
from app.services.user import token_service, user_service

logger = get_logger(logger_name=__name__)

bearer_scheme = HTTPBearer(auto_error=False)


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
            try:
                yield session

            except RefreshTokenReusedException:
                await session.commit()
                raise

    finally:
        await session.commit()
        await session.close()


async def get_user_id(*, credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> UUID:
    if credentials is None:
        raise InvalidTokenException(log_message="Bearer access token missing", logger=logger)

    user_id: UUID = token_service.verify_access_token(access_token=credentials.credentials)
    return user_id


async def get_onboarded_user_id(
    *, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db_transaction)
) -> UUID:
    await user_service.get_user_base_currency(db=db, user_id=user_id)
    return user_id
