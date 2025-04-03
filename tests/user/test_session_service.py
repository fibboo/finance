from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.models.user.session import Session as SessionModel
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import UserSessionCreate
from app.schemas.user.user import UserCreate
from app.services.user import session_service


@pytest.mark.asyncio
async def test_revoke_session_ok(db: AsyncSession):
    # Arrange
    user_create = UserCreate(username='test',
                             registration_provider=ProviderType.TELEGRAM,
                             base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    user_session_create = UserSessionCreate(user_id=user_db.id,
                                            expires_at=datetime.now() + timedelta(days=7),
                                            provider=ProviderType.TELEGRAM)
    user_session_db: SessionModel = await user_session_crud.create(db=db, obj_in=user_session_create,
                                                                   commit=True)

    # Act
    await session_service.revoke_session(db=db, token=user_session_db.id)
    await db.commit()

    # Assert
    user_session_revoked: SessionModel | None = await user_session_crud.get_or_none(db=db,
                                                                                    id=user_session_db.id)

    assert user_session_revoked.expires_at <= datetime.now()
    assert user_session_revoked.expires_at <= user_session_db.expires_at
