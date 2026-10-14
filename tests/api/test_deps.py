from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.api.deps import get_user_id
from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.exceptions.unauthorized_401 import SessionExpiredException
from app.models.user.session import Session as SessionModel
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import UserSessionCreate
from app.schemas.user.user import UserCreate


async def test_get_user_id_active_session(db: AsyncSession):
    # Arrange
    user_create: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency=CurrencyType.USD
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    session_create: UserSessionCreate = UserSessionCreate(
        user_id=user_db.id, expires_at=datetime.now() + timedelta(days=7), provider=ProviderType.TELEGRAM
    )
    session_db: SessionModel = await user_session_crud.create(db=db, obj_in=session_create, commit=True)

    # Act
    user_id: UUID = await get_user_id(x_auth_token=session_db.id, db=db)

    # Assert
    assert user_id == user_db.id


async def test_get_user_id_expired_session(db: AsyncSession):
    # Arrange
    user_create: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency=CurrencyType.USD
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    session_create: UserSessionCreate = UserSessionCreate(
        user_id=user_db.id, expires_at=datetime.now() - timedelta(seconds=1), provider=ProviderType.TELEGRAM
    )
    session_db: SessionModel = await user_session_crud.create(db=db, obj_in=session_create, commit=True)

    # Act / Assert
    with pytest.raises(SessionExpiredException) as exc:
        await get_user_id(x_auth_token=session_db.id, db=db)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.SESSION_EXPIRED


async def test_get_user_id_unknown_token(db: AsyncSession):
    # Arrange
    token: UUID = uuid4()

    # Act / Assert
    with pytest.raises(SessionExpiredException) as exc:
        await get_user_id(x_auth_token=token, db=db)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.SESSION_EXPIRED
