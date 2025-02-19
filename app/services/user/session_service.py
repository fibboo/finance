from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.crud.user.session import user_session_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.user.session import UserSession as UserSessionModel
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import SessionAuth, UserSession, UserSessionCreate

logger = get_logger(__name__)


async def create_session(db: AsyncSession,
                         user_id: UUID,
                         provider: ProviderType,
                         session_auth: SessionAuth) -> UserSession:
    expires_at: datetime = datetime.now() + timedelta(seconds=settings.session_expire_seconds)
    session_create: UserSessionCreate = UserSessionCreate(user_id=user_id,
                                                          expires_at=expires_at,
                                                          provider=provider,
                                                          access_token=session_auth.access_token,
                                                          token_type=session_auth.token_type,
                                                          expires_in=session_auth.expires_in,
                                                          refresh_token=session_auth.refresh_token,
                                                          scope=session_auth.scope)
    session_db: UserSessionModel = await user_session_crud.create(db=db, obj_in=session_create)

    session: UserSession = UserSession.model_validate(session_db)
    return session


async def get_session_by_token(db: AsyncSession, token: UUID) -> UserSession:
    user_session_db: UserSessionModel | None = await user_session_crud.get_or_none(db=db, id=token)
    if user_session_db is None:
        raise EntityNotFound(entity=UserSessionModel, search_params={'id': token}, logger=logger)

    user_session: UserSession = UserSession.model_validate(user_session_db)
    return user_session


async def revoke_session(db: AsyncSession, token: UUID) -> None:
    await user_session_crud.revoke(db=db, id=token)
