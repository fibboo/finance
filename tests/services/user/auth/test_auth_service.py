import hashlib
import time
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import UUID, uuid4

import pytest
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from joserfc import jwt
from joserfc.jwk import ECKey, OctKey, RSAKey
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
from app.exceptions.conflict_409 import (
    IdentityLinkedToAnotherUser,
    LastIdentityUnlinkForbidden,
    ProviderAlreadyLinked,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unauthorized_401 import InvalidAuthData, InvalidTokenException
from app.exceptions.unprocessable_422 import RedirectUriNotAllowed
from app.models.user.authorization_request import AuthorizationRequest as AuthorizationRequestModel
from app.models.user.external_user import ExternalUser as ExternalUserModel
from app.models.user.refresh_token import RefreshToken as RefreshTokenModel
from app.models.user.user import User as UserModel
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.authorization_request import AuthorizationUrlResponse, AuthorizeRequest, CallbackRequest
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenPair, TokenRequest
from app.schemas.user.user import UserCreate
from app.services.user.auth import auth_service


@pytest.mark.parametrize(
    "provider, signing_key_fixture, authorization_endpoint, client_id, scope",
    [
        (
            ProviderType.TELEGRAM,
            "telegram_signing_key",
            "https://oauth.telegram.org/auth",
            "123456789",
            "openid profile",
        ),
        (
            ProviderType.GOOGLE,
            "google_signing_key",
            "https://accounts.google.com/o/oauth2/v2/auth",
            "fake_google_client_id.apps.googleusercontent.com",
            "openid profile email",
        ),
    ],
    ids=["telegram", "google"],
)
async def test_authorize_ok(
    db: AsyncSession,
    db_transaction: AsyncSession,
    request: pytest.FixtureRequest,
    provider: ProviderType,
    signing_key_fixture: str,
    authorization_endpoint: str,
    client_id: str,
    scope: str,
):
    # Arrange
    request.getfixturevalue(signing_key_fixture)
    client_code_challenge: str = create_s256_code_challenge("client_code_verifier_of_at_least_43_characters")

    # Act
    authorization_url: str = await auth_service.authorize(
        db=db_transaction,
        provider=provider,
        authorize_request=AuthorizeRequest(
            redirect_uri="https://finance.test/auth/callback",
            code_challenge=client_code_challenge,
            code_challenge_method="S256",
            state="client_state",
        ),
    )
    await db_transaction.commit()

    # Assert
    request_db: AuthorizationRequestModel = await authorization_request_crud.get(db=db)
    assert request_db.provider == provider
    assert request_db.client_redirect_uri == "https://finance.test/auth/callback"
    assert request_db.client_state == "client_state"
    assert request_db.client_code_challenge == client_code_challenge
    assert request_db.expires_at > datetime.now()
    assert request_db.user_id is None
    assert request_db.code_hash is None

    # the provider gets our own state, nonce and PKCE challenge, never the client's
    url = urlsplit(authorization_url)
    assert f"{url.scheme}://{url.netloc}{url.path}" == authorization_endpoint
    params: dict[str, list[str]] = parse_qs(url.query)
    assert params["client_id"] == [client_id]
    assert params["response_type"] == ["code"]
    assert params["scope"] == [scope]
    assert params["redirect_uri"] == [f"{settings.public_base_url}/user/auth/callback/{provider.value}"]
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
            authorize_request=AuthorizeRequest(
                redirect_uri="https://attacker.test/callback",
                code_challenge="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
                code_challenge_method="S256",
                state="client_state",
            ),
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
            authorize_request=AuthorizeRequest(
                redirect_uri="https://finance.test/auth/callback",
                code_challenge="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
                code_challenge_method="S256",
                state="client_state",
            ),
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id="1234123412341234123", provider=ProviderType.TELEGRAM
    )
    assert user_db.username == "telegram_1234123412341234123"


@pytest.mark.parametrize(
    ("issuer", "email_claims", "expected_email"),
    [
        ("https://accounts.google.com", {"email": "john.doe@gmail.com", "email_verified": True}, "john.doe@gmail.com"),
        ("accounts.google.com", {"email": "john.doe@gmail.com", "email_verified": True}, "john.doe@gmail.com"),
        ("https://accounts.google.com", {"email": "john.doe@gmail.com", "email_verified": False}, None),
        ("https://accounts.google.com", {"email": "john.doe@gmail.com"}, None),
    ],
    ids=["verified_email", "issuer_without_scheme", "unverified_email", "email_without_email_verified"],
)
async def test_callback_google_creates_user(
    db: AsyncSession,
    db_transaction: AsyncSession,
    httpx_mock: HTTPXMock,
    google_signing_key: RSAKey,
    issuer: str,
    email_claims: dict,
    expected_email: str | None,
):
    # Arrange
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
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
        {"alg": "RS256", "kid": "google-test-key"},
        {
            "iss": issuer,
            "aud": "fake_google_client_id.apps.googleusercontent.com",
            "sub": "110169484474386276334",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "name": "John Doe",
            "given_name": "John",
            "family_name": "Doe",
            "picture": "https://lh3.googleusercontent.com/a/johndoe",
        }
        | email_claims,
        google_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth2.googleapis.com/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3599,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction,
        provider=ProviderType.GOOGLE,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    params: dict[str, list[str]] = parse_qs(urlsplit(redirect_url).query)
    assert "code" in params

    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id="110169484474386276334", provider=ProviderType.GOOGLE
    )
    assert user_db is not None
    assert user_db.username == "google_110169484474386276334"
    assert user_db.avatar == "https://lh3.googleusercontent.com/a/johndoe"
    assert user_db.registration_provider == ProviderType.GOOGLE
    assert user_db.external_users[0].first_name == "John"
    assert user_db.external_users[0].last_name == "Doe"
    assert user_db.external_users[0].email == expected_email


async def test_callback_google_issuer_not_allowed(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, google_signing_key: RSAKey
):
    # Arrange
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
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
    # neither the discovery issuer nor one of Google's issuer aliases
    id_token: str = jwt.encode(
        {"alg": "RS256", "kid": "google-test-key"},
        {
            "iss": "https://accounts.google.com.attacker.test",
            "aud": "fake_google_client_id.apps.googleusercontent.com",
            "sub": "110169484474386276334",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
        },
        google_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth2.googleapis.com/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3599,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction,
        provider=ProviderType.GOOGLE,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0


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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code=None, error="access_denied"),
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
    assert request_db.used is True


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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.code_hash is None
    assert request_db.used is True


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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0


@pytest.mark.parametrize(
    "state, expires_in, code_hash, used",
    [
        ("unknown_state", timedelta(minutes=10), None, False),
        ("state", -timedelta(seconds=1), None, False),
        ("state", timedelta(minutes=10), hashlib.sha256(b"issued_code").hexdigest(), False),
        ("state", timedelta(minutes=10), None, True),
    ],
    ids=["unknown_state", "expired", "already_completed", "link_already_completed"],
)
async def test_callback_invalid_state(
    db: AsyncSession,
    db_transaction: AsyncSession,
    state: str,
    expires_in: timedelta,
    code_hash: str | None,
    used: bool,
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
            "used": used,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidAuthData) as exc:
        await auth_service.callback(
            db=db_transaction,
            provider=ProviderType.TELEGRAM,
            callback_request=CallbackRequest(state=state, code="provider_code", error=None),
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


async def test_grant_token_authorization_code(db: AsyncSession, db_transaction: AsyncSession):
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
    token_request = TokenRequest(
        grant_type="authorization_code",
        code="one_time_code",
        redirect_uri="https://finance.test/auth/callback",
        code_verifier="client_code_verifier_of_at_least_43_characters",
    )

    # Act
    token: TokenPair = await auth_service.grant_token(
        db=db_transaction, token_request=token_request, refresh_token="old_refresh_token"
    )
    await db_transaction.commit()

    # Assert
    claims: dict = jwt.decode(token.access_token, OctKey.import_key(settings.jwt_secret), algorithms=["HS256"]).claims
    assert UUID(claims["sub"]) == user_db.id

    # the presented token is revoked and the new token starts a family of its own
    await db.refresh(old_token_db)
    assert old_token_db.revoked is True

    new_token_hash: str = hashlib.sha256(token.refresh_token.encode("utf-8")).hexdigest()
    new_token_db: RefreshTokenModel = await refresh_token_crud.get(db=db, token_hash=new_token_hash)
    assert new_token_db.family_id != old_token_db.family_id

    request_db: AuthorizationRequestModel = await authorization_request_crud.get(db=db)
    assert request_db.used is True


async def test_grant_token_refresh_token(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
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
    token: TokenPair = await auth_service.grant_token(
        db=db_transaction, token_request=TokenRequest(grant_type="refresh_token"), refresh_token="old_refresh_token"
    )
    await db_transaction.commit()

    # Assert
    claims: dict = jwt.decode(token.access_token, OctKey.import_key(settings.jwt_secret), algorithms=["HS256"]).claims
    assert UUID(claims["sub"]) == user_db.id

    # the presented token is revoked and the new token stays in its family
    await db.refresh(old_token_db)
    assert old_token_db.revoked is True

    new_token_hash: str = hashlib.sha256(token.refresh_token.encode("utf-8")).hexdigest()
    new_token_db: RefreshTokenModel = await refresh_token_crud.get(db=db, token_hash=new_token_hash)
    assert new_token_db.family_id == old_token_db.family_id


async def test_grant_token_refresh_token_without_cookie(db: AsyncSession, db_transaction: AsyncSession):
    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await auth_service.grant_token(
            db=db_transaction, token_request=TokenRequest(grant_type="refresh_token"), refresh_token=None
        )

    assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN


async def test_callback_invalid_optional_claims(
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
    # names of the wrong type, a username too long for users.username and a picture too long for users.avatar
    id_token: str = jwt.encode(
        {"alg": "ES256", "kid": "telegram-test-key"},
        {
            "iss": "https://oauth.telegram.org",
            "aud": "123456789",
            "sub": "1234123412341234123",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "given_name": 42,
            "family_name": ["Doe"],
            "preferred_username": "j" * 65,
            "picture": "https://t.me/" + "p" * 2560,
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    assert "code" in parse_qs(urlsplit(redirect_url).query)

    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id="1234123412341234123", provider=ProviderType.TELEGRAM
    )
    assert user_db.username == "telegram_1234123412341234123"
    assert user_db.avatar is None
    assert user_db.external_users[0].username == "j" * 65
    assert user_db.external_users[0].first_name is None
    assert user_db.external_users[0].last_name is None


async def test_callback_subject_not_string(
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
            "sub": 1234123412341234123,
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
    redirect_url: str = await auth_service.callback(
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 0

    await db.refresh(request_db)
    assert request_db.used is True


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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
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
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
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
        db=db_transaction,
        provider=ProviderType.TELEGRAM,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    assert parse_qs(urlsplit(redirect_url).query) == {"error": ["server_error"], "state": ["client_state"]}

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).unique().all()
    assert len(users_db) == 2

    await db.refresh(request_db)
    assert request_db.code_hash is None
    assert request_db.user_id is None
    assert request_db.used is True


async def test_start_link_ok(db: AsyncSession, db_transaction: AsyncSession, google_signing_key: RSAKey):
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

    # Act
    authorization_url_response: AuthorizationUrlResponse = await auth_service.start_link(
        db=db_transaction,
        user_id=user_db.id,
        provider=ProviderType.GOOGLE,
        authorize_request=AuthorizeRequest(
            redirect_uri="https://finance.test/auth/callback",
            code_challenge="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
            code_challenge_method="S256",
            state="client_state",
        ),
    )
    await db_transaction.commit()

    # Assert
    request_db: AuthorizationRequestModel = await authorization_request_crud.get(db=db)
    assert request_db.provider == ProviderType.GOOGLE
    assert request_db.link_user_id == user_db.id
    assert parse_qs(urlsplit(authorization_url_response.authorization_url).query)["state"] == [request_db.state]


async def test_start_link_provider_already_linked(db: AsyncSession, db_transaction: AsyncSession):
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

    # Act / Assert
    with pytest.raises(ProviderAlreadyLinked) as exc:
        await auth_service.start_link(
            db=db_transaction,
            user_id=user_db.id,
            provider=ProviderType.TELEGRAM,
            authorize_request=AuthorizeRequest(
                redirect_uri="https://finance.test/auth/callback",
                code_challenge="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
                code_challenge_method="S256",
                state="client_state",
            ),
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.PROVIDER_ALREADY_LINKED

    requests_db: list[AuthorizationRequestModel] = await authorization_request_crud.get_batch(db=db)
    assert len(requests_db) == 0


async def test_callback_link_issues_code(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, google_signing_key: RSAKey
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
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
            "link_user_id": user_db.id,
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "RS256", "kid": "google-test-key"},
        {
            "iss": "https://accounts.google.com",
            "aud": "fake_google_client_id.apps.googleusercontent.com",
            "sub": "110169484474386276334",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "email": "john.doe@gmail.com",
            "email_verified": True,
            "given_name": "John",
        },
        google_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth2.googleapis.com/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3599,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction,
        provider=ProviderType.GOOGLE,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    url = urlsplit(redirect_url)
    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://finance.test/auth/callback"
    params: dict[str, list[str]] = parse_qs(url.query)
    assert params["state"] == ["client_state"]

    # the identity waits on the request until the signed-in client completes the link
    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 1

    await db.refresh(request_db)
    assert request_db.code_hash == hashlib.sha256(params["code"][0].encode("utf-8")).hexdigest()
    assert request_db.user_id is None
    assert request_db.used is False
    assert request_db.link_identity["provider"] == ProviderType.GOOGLE.value
    assert request_db.link_identity["external_id"] == "110169484474386276334"
    assert request_db.link_identity["first_name"] == "John"
    assert request_db.link_identity["email"] == "john.doe@gmail.com"


async def test_callback_link_identity_of_another_user(
    db: AsyncSession, db_transaction: AsyncSession, httpx_mock: HTTPXMock, google_signing_key: RSAKey
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
    other_user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.GOOGLE), commit=True
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": other_user_db.id,
            "provider": ProviderType.GOOGLE,
            "external_id": "110169484474386276334",
            "username": "janedoe",
        },
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now() + timedelta(minutes=10),
            "link_user_id": user_db.id,
        },
        commit=True,
    )
    id_token: str = jwt.encode(
        {"alg": "RS256", "kid": "google-test-key"},
        {
            "iss": "https://accounts.google.com",
            "aud": "fake_google_client_id.apps.googleusercontent.com",
            "sub": "110169484474386276334",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "nonce": "nonce",
            "email": "john.doe@gmail.com",
            "email_verified": True,
            "given_name": "John",
        },
        google_signing_key,
    )
    httpx_mock.add_response(
        method="POST",
        url="https://oauth2.googleapis.com/token",
        json={
            "access_token": "provider_access_token",
            "token_type": "Bearer",
            "expires_in": 3599,
            "id_token": id_token,
        },
    )

    # Act
    redirect_url: str = await auth_service.callback(
        db=db_transaction,
        provider=ProviderType.GOOGLE,
        callback_request=CallbackRequest(state="state", code="provider_code", error=None),
    )
    await db_transaction.commit()

    # Assert
    params: dict[str, list[str]] = parse_qs(urlsplit(redirect_url).query)
    assert params == {"error": ["IDENTITY_LINKED_TO_ANOTHER_USER"], "state": ["client_state"]}

    # the identity stays with its owner, and the request is used up so its state cannot be replayed
    external_user_db: ExternalUserModel = await external_user_crud.get(db=db, provider=ProviderType.GOOGLE)
    assert external_user_db.user_id == other_user_db.id

    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db, user_id=user_db.id)
    assert len(external_users_db) == 1

    await db.refresh(request_db)
    assert request_db.used is True
    assert request_db.code_hash is None


async def test_unlink_ok(db: AsyncSession, db_transaction: AsyncSession):
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
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "provider": ProviderType.GOOGLE,
            "external_id": "110169484474386276334",
            "username": "google_110169484474386276334",
        },
        commit=True,
    )

    # Act
    await auth_service.unlink(db=db_transaction, user_id=user_db.id, provider=ProviderType.GOOGLE)
    await db_transaction.commit()

    # Assert
    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 1
    assert external_users_db[0].provider == ProviderType.TELEGRAM


async def test_unlink_last_identity(db: AsyncSession, db_transaction: AsyncSession):
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

    # Act / Assert
    with pytest.raises(LastIdentityUnlinkForbidden) as exc:
        await auth_service.unlink(db=db_transaction, user_id=user_db.id, provider=ProviderType.TELEGRAM)
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.LAST_IDENTITY_UNLINK_FORBIDDEN

    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 1


async def test_unlink_not_linked(db: AsyncSession, db_transaction: AsyncSession):
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

    # Act / Assert
    with pytest.raises(EntityNotFound):
        await auth_service.unlink(db=db_transaction, user_id=user_db.id, provider=ProviderType.GOOGLE)
    await db_transaction.commit()

    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 1


async def test_complete_link_ok(db: AsyncSession, db_transaction: AsyncSession):
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
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "link_user_id": user_db.id,
            "link_identity": {
                "provider": "GOOGLE",
                "external_id": "110169484474386276334",
                "username": None,
                "first_name": "John",
                "last_name": None,
                "avatar": None,
                "email": "john.doe@gmail.com",
            },
            "code_hash": hashlib.sha256(b"link_code").hexdigest(),
            "used": False,
        },
        commit=True,
    )

    # Act
    await auth_service.complete_link(
        db=db_transaction,
        user_id=user_db.id,
        provider=ProviderType.GOOGLE,
        code="link_code",
        redirect_uri="https://finance.test/auth/callback",
        code_verifier="client_code_verifier_of_at_least_43_characters",
    )
    await db_transaction.commit()

    # Assert
    external_user_db: ExternalUserModel = await external_user_crud.get(
        db=db, user_id=user_db.id, provider=ProviderType.GOOGLE
    )
    assert external_user_db.external_id == "110169484474386276334"
    assert external_user_db.username == "google_110169484474386276334"
    assert external_user_db.first_name == "John"
    assert external_user_db.email == "john.doe@gmail.com"

    await db.refresh(request_db)
    assert request_db.used is True
    assert request_db.link_identity is None


@pytest.mark.parametrize(
    "user_is_link_user, code_verifier, used",
    [
        (True, "another_code_verifier_of_at_least_43_characters", False),
        (False, "client_code_verifier_of_at_least_43_characters", False),
        (True, "client_code_verifier_of_at_least_43_characters", True),
    ],
    ids=["wrong_code_verifier", "another_signed_in_user", "replayed_code"],
)
async def test_complete_link_invalid(
    db: AsyncSession, db_transaction: AsyncSession, user_is_link_user: bool, code_verifier: str, used: bool
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
    other_user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "link_user_id": user_db.id,
            "link_identity": {
                "provider": "GOOGLE",
                "external_id": "110169484474386276334",
                "username": None,
                "first_name": "John",
                "last_name": None,
                "avatar": None,
                "email": "john.doe@gmail.com",
            },
            "code_hash": hashlib.sha256(b"link_code").hexdigest(),
            "used": used,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await auth_service.complete_link(
            db=db_transaction,
            user_id=user_db.id if user_is_link_user else other_user_db.id,
            provider=ProviderType.GOOGLE,
            code="link_code",
            redirect_uri="https://finance.test/auth/callback",
            code_verifier=code_verifier,
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN

    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 1

    await db.refresh(request_db)
    assert request_db.used is used


async def test_complete_link_already_linked_to_same_user(db: AsyncSession, db_transaction: AsyncSession):
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
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "provider": ProviderType.GOOGLE,
            "external_id": "110169484474386276334",
            "username": "google_110169484474386276334",
        },
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "link_user_id": user_db.id,
            "link_identity": {
                "provider": "GOOGLE",
                "external_id": "110169484474386276334",
                "username": None,
                "first_name": "John",
                "last_name": None,
                "avatar": None,
                "email": "john.doe@gmail.com",
            },
            "code_hash": hashlib.sha256(b"link_code").hexdigest(),
            "used": False,
        },
        commit=True,
    )

    # Act
    await auth_service.complete_link(
        db=db_transaction,
        user_id=user_db.id,
        provider=ProviderType.GOOGLE,
        code="link_code",
        redirect_uri="https://finance.test/auth/callback",
        code_verifier="client_code_verifier_of_at_least_43_characters",
    )
    await db_transaction.commit()

    # Assert
    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 2

    await db.refresh(request_db)
    assert request_db.used is True
    assert request_db.link_identity is None


async def test_complete_link_provider_linked_meanwhile(db: AsyncSession, db_transaction: AsyncSession):
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
    # another Google identity was linked after the link callback
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "provider": ProviderType.GOOGLE,
            "external_id": "999999999999999999999",
            "username": "google_999999999999999999999",
        },
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "link_user_id": user_db.id,
            "link_identity": {
                "provider": "GOOGLE",
                "external_id": "110169484474386276334",
                "username": None,
                "first_name": "John",
                "last_name": None,
                "avatar": None,
                "email": "john.doe@gmail.com",
            },
            "code_hash": hashlib.sha256(b"link_code").hexdigest(),
            "used": False,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(ProviderAlreadyLinked) as exc:
        await auth_service.complete_link(
            db=db_transaction,
            user_id=user_db.id,
            provider=ProviderType.GOOGLE,
            code="link_code",
            redirect_uri="https://finance.test/auth/callback",
            code_verifier="client_code_verifier_of_at_least_43_characters",
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.PROVIDER_ALREADY_LINKED

    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db)
    assert len(external_users_db) == 2


async def test_complete_link_identity_linked_meanwhile(db: AsyncSession, db_transaction: AsyncSession):
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
    # the identity signed up on its own after the link callback
    other_user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.GOOGLE), commit=True
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": other_user_db.id,
            "provider": ProviderType.GOOGLE,
            "external_id": "110169484474386276334",
            "username": "janedoe",
        },
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "link_user_id": user_db.id,
            "link_identity": {
                "provider": "GOOGLE",
                "external_id": "110169484474386276334",
                "username": None,
                "first_name": "John",
                "last_name": None,
                "avatar": None,
                "email": "john.doe@gmail.com",
            },
            "code_hash": hashlib.sha256(b"link_code").hexdigest(),
            "used": False,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(IdentityLinkedToAnotherUser) as exc:
        await auth_service.complete_link(
            db=db_transaction,
            user_id=user_db.id,
            provider=ProviderType.GOOGLE,
            code="link_code",
            redirect_uri="https://finance.test/auth/callback",
            code_verifier="client_code_verifier_of_at_least_43_characters",
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.IDENTITY_LINKED_TO_ANOTHER_USER

    external_users_db: list[ExternalUserModel] = await external_user_crud.get_batch(db=db, user_id=user_db.id)
    assert len(external_users_db) == 1


async def test_exchange_code_link_code(db: AsyncSession, db_transaction: AsyncSession):
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
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": create_s256_code_challenge("client_code_verifier_of_at_least_43_characters"),
            "expires_at": datetime.now() + timedelta(minutes=1),
            "link_user_id": user_db.id,
            "link_identity": {
                "provider": "GOOGLE",
                "external_id": "110169484474386276334",
                "username": None,
                "first_name": "John",
                "last_name": None,
                "avatar": None,
                "email": "john.doe@gmail.com",
            },
            "code_hash": hashlib.sha256(b"link_code").hexdigest(),
            "used": False,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await auth_service.exchange_code(
            db=db_transaction,
            code="link_code",
            redirect_uri="https://finance.test/auth/callback",
            code_verifier="client_code_verifier_of_at_least_43_characters",
        )
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN

    await db.refresh(request_db)
    assert request_db.used is False
