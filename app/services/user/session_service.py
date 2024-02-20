from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.crud.user.session import user_session_crud
from app.models.user.session import UserSession as UserSessionModel
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import UserSession, SessionAuth, UserSessionCreate


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


async def revoke_session(db: AsyncSession, token: UUID) -> None:
    await user_session_crud.revoke(db=db, id=token)
