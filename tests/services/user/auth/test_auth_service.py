import hashlib
import time
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import UUID, uuid4

import pytest
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from joserfc import jwt
from joserfc.jwk import ECKey, OctKey
from pytest_httpx import HTTPXMock
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.settings import settings
from app.crud.user.authorization_request import authorization_request_crud
from app.crud.user.external_user import external_user_crud
from app.crud.user.refresh_token import refresh_token_crud
from app.crud.user.user import user_crud
from app.exceptions.bad_gateway_502 import ProviderUnavailable
from app.exceptions.unauthorized_401 import InvalidAuthData, InvalidTokenException
from app.exceptions.unprocessable_422 import RedirectUriNotAllowed
from app.models.user.authorization_request import AuthorizationRequest as AuthorizationRequestModel
from app.models.user.refresh_token import RefreshToken as RefreshTokenModel
from app.models.user.user import User as UserModel
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenPair
from app.schemas.user.user import UserCreate
from app.services.user.auth import auth_service


async def test_authorize_ok(db: AsyncSession, db_transaction: AsyncSession, telegram_signing_key: ECKey):
    # Arrange
    client_code_challenge: str = create_s256_code_challenge("client_code_verifier_of_at_least_43_characters")

    # Act
    authorization_url: str = await auth_service.authorize(
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        redirect_uri="https://finance.test/auth/callback",
        code_challenge=client_code_challenge,
        client_state="client_state",
    )
    await db_transaction.commit()

    # Assert
    request_db: AuthorizationRequestModel = await authorization_request_crud.get(db=db)
    assert request_db.provider == ProviderType.TELEGRAM
    assert request_db.client_redirect_uri == "https://finance.test/auth/callback"
    assert request_db.client_state == "client_state"
    assert request_db.client_code_challenge == client_code_challenge
    assert request_db.expires_at > datetime.now()
    assert request_db.user_id is None
    assert request_db.code_hash is None

    # the provider gets our own state, nonce and PKCE challenge, never the client's
    url = urlsplit(authorization_url)
    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://oauth.telegram.org/auth"
    params: dict[str, list[str]] = parse_qs(url.query)
    assert params["client_id"] == ["123456789"]
    assert params["response_type"] == ["code"]
    assert params["scope"] == ["openid profile"]
    assert params["redirect_uri"] == [f"{settings.public_base_url}/user/auth/callback/TELEGRAM"]
    assert params["state"] == [request_db.state]
    assert params["nonce"] == [request_db.nonce]
    assert params["code_challenge"] == [create_s256_code_challenge(request_db.provider_code_verifier)]
    assert params["code_challenge_method"] == ["S256"]


async def test_authorize_redirect_uri_not_allowed(db: AsyncSession, db_transaction: AsyncSession):
    # Act / Assert
    with pytest.raises(RedirectUriNotAllowed) as exc:
        await auth_service.authorize(
            db=db_transaction,
            provider=ProviderType.TELEGRAM,
            redirect_uri="https://attacker.test/callback",
            code_challenge="challenge",
            client_state="client_state",
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.REDIRECT_URI_NOT_ALLOWED

    requests_db: list[AuthorizationRequestModel] = await authorization_request_crud.get_batch(db=db)
    assert len(requests_db) == 0


@pytest.mark.parametrize(
    "discovery_response",
    [
        {"status_code": 503},
        {"content": b"<html>Service Unavailable</html>"},
        {
            "json": {
                "issuer": "https://oauth.telegram.org",
                "token_endpoint": "https://oauth.telegram.org/token",
                "jwks_uri": "https://oauth.telegram.org/.well-known/jwks.json",
            }
        },
    ],
    ids=["unavailable", "not_json", "no_authorization_endpoint"],
)
async def test_authorize_provider_unavailable(
    db_transaction: AsyncSession, httpx_mock: HTTPXMock, discovery_response: dict
):
    # Arrange
    httpx_mock.add_response(
        method="GET", url="https://oauth.telegram.org/.well-known/openid-configuration", **discovery_response
    )

    # Act / Assert
    with pytest.raises(ProviderUnavailable) as exc:
        await auth_service.authorize(
            db=db_transaction,
            provider=ProviderType.TELEGRAM,
            redirect_uri="https://finance.test/auth/callback",
            code_challenge="challenge",
            client_state="client_state",
        )

    assert exc.value.status_code == status.HTTP_502_BAD_GATEWAY
    assert exc.value.error_code == ErrorCodeType.PROVIDER_UNAVAILABLE


async def test_callback_creates_user(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {
            "iss": "https://oauth.telegram.org",
            "aud": "123456789",
            "sub": "1234123412341234123",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "id": 987654321,
            "name": "John Doe",
            "given_name": "John",
            "family_name": "Doe",
            "preferred_username": "johndoe",
            "picture": "https://t.me/i/userpic/320/johndoe.jpg",
        },
        telegram_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    url = urlsplit(redirect_url)
    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://finance.test/auth/callback"
    params: dict[str, list[str]] = parse_qs(url.query)
    assert params["state"] == ["client_state"]

    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id="1234123412341234123", provider=ProviderType.TELEGRAM
    )
    assert user_db is not None
    assert user_db.username == "johndoe"
    assert user_db.avatar == "https://t.me/i/userpic/320/johndoe.jpg"
    assert user_db.registration_provider == ProviderType.TELEGRAM
    assert user_db.base_currency is None
    assert user_db.external_users[0].first_name == "John"
    assert user_db.external_users[0].last_name == "Doe"

    # only the hash of the one-time code is stored, with a short expiry
    await db.refresh(request_db)
    assert request_db.code_hash == hashlib.sha256(params["code"][0].encode("utf-8")).hexdigest()
    assert request_db.user_id == user_db.id
    assert request_db.expires_at <= datetime.now() + timedelta(minutes=1)
    assert request_db.used is False


async def test_callback_existing_user(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "provider": ProviderType.TELEGRAM,
            "external_id": "1234123412341234123",
            "username": "johndoe",
        },
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {
            "iss": "https://oauth.telegram.org",
            "aud": "123456789",
            "sub": "1234123412341234123",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
        },
        telegram_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token,
        },
    )

    # Act
    await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 1

    await db.refresh(request_db)
    assert request_db.user_id == user_db.id
    assert request_db.code_hash is not None


async def test_callback_without_username(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {
            "iss": "https://oauth.telegram.org",
            "aud": "123456789",
            "sub": "1234123412341234123",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "name": "John",
        },
        telegram_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token,
        },
    )

    # Act
    await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id="1234123412341234123", provider=ProviderType.TELEGRAM
    )
    assert user_db.username == "telegram_1234123412341234123"


async def test_callback_provider_error(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback?source=app",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code=None, error="access_denied"
    )
    await db_transaction.commit()

    # Assert
    url = urlsplit(redirect_url)
    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://finance.test/auth/callback"
    assert parse_qs(url.query) == {"source": ["app"], "error": ["access_denied"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.code_hash is None
    assert request_db.user_id is None


@pytest.mark.parametrize(
    "claims",
    [
        {"iss": "https://attacker.test", "aud": "123456789", "nonce": "nonce"},
        {"iss": "https://oauth.telegram.org", "aud": "987654321", "nonce": "nonce"},
        {"iss": "https://oauth.telegram.org", "aud": "123456789", "nonce": "another_nonce"},
        {"iss": "https://oauth.telegram.org", "aud": "123456789"},
        {"iss": "https://oauth.telegram.org", "aud": "123456789", "nonce": "nonce", "exp": 946684800},
    ],
    ids=["wrong_issuer", "wrong_audience", "wrong_nonce", "missing_nonce", "expired"],
)
async def test_callback_invalid_id_token(
    db: AsyncSession,
    db_transaction: AsyncSession,
    httpx_mock: HTTPXMock,
    telegram_signing_key: ECKey,
    claims: dict,
):
    # Arrange
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {"sub": "1234123412341234123", "iat": int(time.time()), "exp": int(time.time()) + 600} | claims,
        telegram_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.code_hash is None


async def test_callback_wrong_signing_key(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {
            "iss": "https://oauth.telegram.org",
            "aud": "123456789",
            "sub": "1234123412341234123",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
        },
        ECKey.generate_key("P-256"),
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0


async def test_callback_token_endpoint_error(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    httpx_mock.add_response(
        method="POST", url="https://oauth.telegram.org/token", status_code=400, json={"error": "invalid_grant"}
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0


@pytest.mark.parametrize(
    "state, expires_in, code_hash",
    [
        ("unknown_state", timedelta(minutes=10), None),
        ("state", -timedelta(seconds=1), None),
        ("state", timedelta(minutes=10), hashlib.sha256(b"issued_code").hexdigest()),
    ],
    ids=["unknown_state", "expired", "already_completed"],
)
async def test_callback_invalid_state(
    db: AsyncSession, db_transaction: AsyncSession, state: str, expires_in: timedelta, code_hash: str | None
):
    # Arrange
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + expires_in,
            "code_hash": code_hash,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidAuthData) as exc:
        await auth_service.callback(
            db=db_transaction, provider=ProviderType.TELEGRAM, state=state, code="provider_code", error=None
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_AUTH_DATA

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0


async def test_exchange_code_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "user_id": user_db.id,
            "code_hash": hashlib.sha256(b"one_time_code").hexdigest(),
        },
        commit=True,
    )

    # Act
    token: TokenPair = await auth_service.exchange_code(
        db=db_transaction,
        code="one_time_code",
        redirect_uri="https://finance.test/auth/callback",
        code_verifier="client_code_verifier_of_at_least_43_characters",
    )
    await db_transaction.commit()

    # Assert
    claims: dict = jwt.decode(token.access_token, OctKey.import_key(settings.jwt_secret), algorithms=["HS256"]).claims
    assert UUID(claims["sub"]) == user_db.id
    assert token.refresh_token is not None

    await db.refresh(request_db)
    assert request_db.used is True


async def test_exchange_code_revokes_presented_refresh_token(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "user_id": user_db.id,
            "code_hash": hashlib.sha256(b"one_time_code").hexdigest(),
        },
        commit=True,
    )
    old_token_db: RefreshTokenModel = await refresh_token_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "token_hash": hashlib.sha256(b"old_refresh_token").hexdigest(),
            "family_id": uuid4(),
            "expires_at": datetime.now() + timedelta(days=1),
        },
        commit=True,
    )

    # Act
    token: TokenPair = await auth_service.exchange_code(
        db=db_transaction,
        code="one_time_code",
        redirect_uri="https://finance.test/auth/callback",
        code_verifier="client_code_verifier_of_at_least_43_characters",
        refresh_token="old_refresh_token",
    )
    await db_transaction.commit()

    # Assert
    await db.refresh(old_token_db)
    assert old_token_db.revoked is True

    new_token_hash: str = hashlib.sha256(token.refresh_token.encode("utf-8")).hexdigest()
    new_token_db: RefreshTokenModel = await refresh_token_crud.get(db=db, token_hash=new_token_hash)
    assert new_token_db.family_id != old_token_db.family_id
    assert new_token_db.revoked is False


@pytest.mark.parametrize(
    "code, redirect_uri, code_verifier, used",
    [
        ("unknown_code", "https://finance.test/auth/callback", "client_code_verifier_of_at_least_43_characters", False),
        ("one_time_code", "https://finance.test/auth/callback", "client_code_verifier_of_at_least_43_characters", True),
        (
            "one_time_code",
            "https://finance.test/other/callback",
            "client_code_verifier_of_at_least_43_characters",
            False,
        ),
        (
            "one_time_code",
            "https://finance.test/auth/callback",
            "another_code_verifier_of_at_least_43_characters",
            False,
        ),
    ],
    ids=["unknown_code", "used_code", "redirect_uri_mismatch", "wrong_code_verifier"],
)
async def test_exchange_code_invalid(
    db: AsyncSession, db_transaction: AsyncSession, code: str, redirect_uri: str, code_verifier: str, used: bool
):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "user_id": user_db.id,
            "code_hash": hashlib.sha256(b"one_time_code").hexdigest(),
            "used": used,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await auth_service.exchange_code(
            db=db_transaction, code=code, redirect_uri=redirect_uri, code_verifier=code_verifier
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN

    request_db: AuthorizationRequestModel = await authorization_request_crud.get(db=db)
    assert request_db.used is used


async def test_exchange_code_expired(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() - timedelta(seconds=1),
            "user_id": user_db.id,
            "code_hash": hashlib.sha256(b"one_time_code").hexdigest(),
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await auth_service.exchange_code(
            db=db_transaction,
            code="one_time_code",
            redirect_uri="https://finance.test/auth/callback",
            code_verifier="client_code_verifier_of_at_least_43_characters",
        )

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN


async def test_callback_no_id_token(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={"access_token": "provider_access_token", "token_type": "Bearer", "expires_in": 3600},
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.code_hash is None


async def test_callback_discovery_without_issuer(db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock):
    # Arrange
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    httpx_mock.add_response(
        method="GET",
        url="https://oauth.telegram.org/.well-known/openid-configuration",
        json={
            "authorization_endpoint": "https://oauth.telegram.org/auth",
            "token_endpoint": "https://oauth.telegram.org/token",
            "jwks_uri": "https://oauth.telegram.org/.well-known/jwks.json",
        },
        is_reusable=True,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": "header.payload.signature",
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.code_hash is None


@pytest.mark.parametrize(
    "discovery, jwks, token_response",
    [
        (
            {"text": "<html>maintenance</html>"},
            None,
            {"json": {"access_token": "provider_access_token", "token_type": "Bearer", "expires_in": 3600}},
        ),
        (
            {
                "json": {
                    "issuer": "https://oauth.telegram.org",
                    "authorization_endpoint": "https://oauth.telegram.org/auth",
                    "token_endpoint": "https://oauth.telegram.org/token",
                    "jwks_uri": "https://oauth.telegram.org/.well-known/jwks.json",
                }
            },
            None,
            {"text": "<html>maintenance</html>"},
        ),
        (
            {
                "json": {
                    "issuer": "https://oauth.telegram.org",
                    "authorization_endpoint": "https://oauth.telegram.org/auth",
                    "token_endpoint": "https://oauth.telegram.org/token",
                    "jwks_uri": "https://oauth.telegram.org/.well-known/jwks.json",
                }
            },
            {"text": "<html>maintenance</html>"},
            {"json": {"access_token": "provider_access_token", "token_type": "Bearer", "id_token": "a.b.c"}},
        ),
        (
            {
                "json": {
                    "issuer": "https://oauth.telegram.org",
                    "authorization_endpoint": "https://oauth.telegram.org/auth",
                    "token_endpoint": "https://oauth.telegram.org/token",
                }
            },
            None,
            {"json": {"access_token": "provider_access_token", "token_type": "Bearer", "id_token": "a.b.c"}},
        ),
    ],
    ids=["discovery_not_json", "token_response_not_json", "jwks_not_json", "discovery_without_jwks_uri"],
)
async def test_callback_broken_provider_response(
    db: AsyncSession,
    db_transaction: AsyncSession,
    httpx_mock: HTTPXMock,
    discovery: dict,
    jwks: dict | None,
    token_response: dict,
):
    # Arrange
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "finance://auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    httpx_mock.add_response(
        method="GET",
        url="https://oauth.telegram.org/.well-known/openid-configuration",
        is_reusable=True,
        **discovery,
    )
    httpx_mock.add_response(method="POST", url="https://oauth.telegram.org/token", is_optional=True, **token_response)
    if jwks is not None:
        httpx_mock.add_response(method="GET", url="https://oauth.telegram.org/.well-known/jwks.json", **jwks)

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        state="state",
        code="provider_code",
        error=None,
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.code_hash is None


async def test_callback_no_free_username(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, telegram_signing_key: ECKey
):
    # Arrange
    # both the provider username and the fallback username belong to other users
    await user_crud.create_batch(
        db=db,
        objs_in=[
            UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM),
            UserCreate(username="telegram_1234123412341234123", registration_provider=ProviderType.TELEGRAM),
        ],
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.TELEGRAM,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {
            "iss": "https://oauth.telegram.org",
            "aud": "123456789",
            "sub": "1234123412341234123",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "preferred_username": "johndoe",
        },
        telegram_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth.telegram.org/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction, provider=ProviderType.TELEGRAM, state="state", code="provider_code", error=None
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 2

    await db.refresh(request_db)
    assert request_db.code_hash is None
    assert request_db.user_id is None
