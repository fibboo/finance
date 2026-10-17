from uuid import UUID, uuid4

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from joserfc import jwt
from joserfc.jwk import OctKey
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.api.deps import (
    get_grant_refresh_token,
    get_onboarded_user_id,
    get_refresh_token,
    get_required_refresh_token,
    get_user_id,
)
from app.configs.settings import settings
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import BaseCurrencyNotSet
from app.exceptions.forbidden_403 import OriginNotAllowed
from app.exceptions.unauthorized_401 import InvalidTokenException
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenRequest
from app.schemas.user.user import UserCreate


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


async def test_get_onboarded_user_id_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency=CurrencyType.USD
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act
    result: UUID = await get_onboarded_user_id(user_id=user_db.id, db=db_transaction)
    await db_transaction.commit()

    # Assert
    assert result == user_db.id


async def test_get_onboarded_user_id_base_currency_not_set(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act / Assert
    with pytest.raises(BaseCurrencyNotSet) as exc:
        await get_onboarded_user_id(user_id=user_db.id, db=db_transaction)

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_NOT_SET


@pytest.mark.parametrize("origin", ["https://finance.test", None], ids=["allowed_origin", "no_origin"])
async def test_get_refresh_token_ok(origin: str | None):
    # Act
    result: str | None = await get_refresh_token(origin=origin, refresh_token="refresh_token_from_cookie")

    # Assert
    assert result == "refresh_token_from_cookie"


async def test_get_refresh_token_no_cookie():
    # Act
    result: str | None = await get_refresh_token(origin="https://finance.test", refresh_token=None)

    # Assert
    assert result is None


async def test_get_refresh_token_origin_not_allowed():
    # Act / Assert
    with pytest.raises(OriginNotAllowed) as exc:
        await get_refresh_token(origin="https://attacker.test", refresh_token="refresh_token_from_cookie")

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.error_code == ErrorCodeType.ORIGIN_NOT_ALLOWED


async def test_get_required_refresh_token_ok():
    # Act
    result: str = await get_required_refresh_token(refresh_token="refresh_token_from_cookie")

    # Assert
    assert result == "refresh_token_from_cookie"


async def test_get_required_refresh_token_no_cookie():
    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await get_required_refresh_token(refresh_token=None)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN


@pytest.mark.parametrize(
    "data, refresh_token",
    [
        (TokenRequest(grant_type="refresh_token"), "refresh_token_from_cookie"),
        (
            TokenRequest(
                grant_type="authorization_code",
                code="one_time_code",
                redirect_uri="https://finance.test/auth/callback",
                code_verifier="client_code_verifier_of_at_least_43_characters",
            ),
            None,
        ),
    ],
    ids=["refresh_grant_with_cookie", "code_grant_without_cookie"],
)
async def test_get_grant_refresh_token_ok(data: TokenRequest, refresh_token: str | None):
    # Act
    result: str | None = await get_grant_refresh_token(data=data, refresh_token=refresh_token)

    # Assert
    assert result == refresh_token


async def test_get_grant_refresh_token_refresh_grant_without_cookie():
    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await get_grant_refresh_token(data=TokenRequest(grant_type="refresh_token"), refresh_token=None)

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN
