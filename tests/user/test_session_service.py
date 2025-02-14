from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.models.user.session import UserSession
from app.models.user.user import User
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import UserSessionCreate
from app.schemas.user.user import UserCreate
from app.services.user.session_service import revoke_session


@pytest.mark.asyncio
async def test_revoke_session(db_fixture: AsyncSession):
    # Given
    user_create = UserCreate(username='test', registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_session_create = UserSessionCreate(user_id=user_db.id,
                                            expires_at=datetime.now() + timedelta(days=7),
                                            provider=ProviderType.TELEGRAM)
    user_session_db: UserSession = await user_session_crud.create(db=db_fixture, obj_in=user_session_create,
                                                                  commit=True)

    # When
    await revoke_session(db=db_fixture, token=user_session_db.id)
    await db_fixture.commit()

    # Then
    user_session_revoked: UserSession | None = await user_session_crud.get_or_none(db=db_fixture,
                                                                                   id=user_session_db.id)

    assert user_session_revoked.expires_at <= datetime.now()
    assert user_session_revoked.expires_at <= user_session_db.expires_at
