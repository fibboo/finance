from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.crud.user.session import user_session_crud
from app.models.user.session import Session as SessionModel
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import AuthData, Session, UserSessionCreate

logger = get_logger(__name__)


async def create_session(db: AsyncSession,
                         user_id: UUID,
                         provider: ProviderType,
                         auth_data: AuthData) -> Session:
    expires_at: datetime = datetime.now() + timedelta(seconds=settings.session_expire_seconds)
    session_create: UserSessionCreate = UserSessionCreate(user_id=user_id,
                                                          expires_at=expires_at,
                                                          provider=provider,
                                                          access_token=auth_data.access_token,
                                                          token_type=auth_data.token_type,
                                                          expires_in=auth_data.expires_in,
                                                          refresh_token=auth_data.refresh_token,
                                                          scope=auth_data.scope)
    session_db: SessionModel = await user_session_crud.create(db=db, obj_in=session_create)

    session: Session = Session.model_validate(session_db)
    return session


async def revoke_session(db: AsyncSession, token: UUID) -> None:
    await user_session_crud.revoke(db=db, id=token)
