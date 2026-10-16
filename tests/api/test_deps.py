from uuid import UUID, uuid4

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from joserfc import jwt
from joserfc.jwk import OctKey
from starlette import status

from app.api.deps import get_user_id
from app.configs.settings import settings
from app.exceptions.unauthorized_401 import InvalidTokenException
from app.schemas.error_response import ErrorCodeType


async def test_get_user_id_valid_token():
    # Arrange
    user_id: UUID = uuid4()
    access_token: str = jwt.encode(
        {"alg": "HS256"}, {"sub": str(user_id), "exp": 4102444800}, OctKey.import_key(settings.jwt_secret)
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)

    # Act
    result: UUID = await get_user_id(credentials=credentials)

    # Assert
    assert result == user_id


async def test_get_user_id_missing_credentials():
    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await get_user_id(credentials=None)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN


async def test_get_user_id_malformed_token():
    # Arrange
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt")

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await get_user_id(credentials=credentials)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN
