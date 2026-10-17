import secrets
from datetime import datetime, timedelta

from authlib.common.urls import add_params_to_uri
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.crud.user.authorization_request import authorization_request_crud
from app.crud.user.user import user_crud
from app.exceptions.unauthorized_401 import InvalidAuthData, InvalidTokenException, TokenExpiredException
from app.exceptions.unprocessable_422 import RedirectUriNotAllowed
from app.models.user.authorization_request import AuthorizationRequest as AuthorizationRequestModel
from app.models.user.user import User as UserModel
from app.schemas.user.authorization_request import AuthorizationRequestCreate, AuthorizationRequestUpdate
from app.schemas.user.external_user import ProviderType
from app.schemas.user.identity import ProviderIdentity
from app.schemas.user.token import TokenResponse
from app.services.user import token_service, user_service
from app.services.user.auth.oidc_provider import OIDCProvider
from app.services.user.auth.providers import providers
from app.utils.utils import hash_secret

logger = get_logger(logger_name=__name__)

AUTHORIZATION_REQUEST_LIFETIME = timedelta(minutes=10)
AUTHORIZATION_CODE_LIFETIME = timedelta(minutes=1)


async def authorize(
    *, db: AsyncSession, provider: ProviderType, redirect_uri: str, code_challenge: str, client_state: str
) -> str:
    if redirect_uri not in settings.allowed_redirect_uris:
        raise RedirectUriNotAllowed(redirect_uri=redirect_uri, logger=logger)

    authorization_request_create = AuthorizationRequestCreate(
        provider=provider,
        state=secrets.token_urlsafe(32),
        nonce=secrets.token_urlsafe(32),
        provider_code_verifier=secrets.token_urlsafe(48),
        client_redirect_uri=redirect_uri,
        client_state=client_state,
        client_code_challenge=code_challenge,
        expires_at=datetime.now() + AUTHORIZATION_REQUEST_LIFETIME,
    )
    await authorization_request_crud.create(db=db, obj_in=authorization_request_create)

    oidc_provider: OIDCProvider = providers[provider]
    authorization_url: str = await oidc_provider.create_authorization_url(
        state=authorization_request_create.state,
        nonce=authorization_request_create.nonce,
        code_verifier=authorization_request_create.provider_code_verifier,
    )
    return authorization_url


async def callback(*, db: AsyncSession, provider: ProviderType, state: str, code: str | None, error: str | None) -> str:
    request_db: AuthorizationRequestModel | None = await authorization_request_crud.get_by_state(db=db, state=state)
    if request_db is None or request_db.provider != provider:
        raise InvalidAuthData(log_message=f"Unknown {provider.value} authorization state", logger=logger)

    if request_db.code_hash is not None:
        raise InvalidAuthData(log_message=f"Authorization request `{request_db.id}` already completed", logger=logger)

    if request_db.expires_at <= datetime.now():
        raise InvalidAuthData(log_message=f"Authorization request `{request_db.id}` expired", logger=logger)

    if error is not None or code is None:
        error_code: str = error if error is not None else "invalid_request"
        error_params: dict[str, str] = {"error": error_code, "state": request_db.client_state}
        error_url: str = add_params_to_uri(request_db.client_redirect_uri, error_params)
        return error_url

    oidc_provider: OIDCProvider = providers[provider]
    identity: ProviderIdentity | None = await oidc_provider.fetch_identity(
        code=code, code_verifier=request_db.provider_code_verifier, nonce=request_db.nonce
    )
    if identity is None:
        error_params: dict[str, str] = {"error": "server_error", "state": request_db.client_state}
        error_url: str = add_params_to_uri(request_db.client_redirect_uri, error_params)
        return error_url

    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id=identity.subject, provider=provider
    )
    if user_db is None:
        user_db: UserModel | None = await user_service.create_user(db=db, identity=identity)
        if user_db is None:
            error_params: dict[str, str] = {"error": "server_error", "state": request_db.client_state}
            error_url: str = add_params_to_uri(request_db.client_redirect_uri, error_params)
            return error_url

    authorization_code: str = secrets.token_urlsafe(32)
    authorization_request_update = AuthorizationRequestUpdate(
        user_id=user_db.id,
        code_hash=hash_secret(secret=authorization_code),
        expires_at=datetime.now() + AUTHORIZATION_CODE_LIFETIME,
    )
    await authorization_request_crud.update_orm(db=db, obj_in=authorization_request_update, id=request_db.id)

    redirect_params: dict[str, str] = {"code": authorization_code, "state": request_db.client_state}
    redirect_url: str = add_params_to_uri(request_db.client_redirect_uri, redirect_params)
    return redirect_url


async def exchange_code(*, db: AsyncSession, code: str, redirect_uri: str, code_verifier: str) -> TokenResponse:
    request_db: AuthorizationRequestModel | None = await authorization_request_crud.get_by_code_hash(
        db=db, code_hash=hash_secret(secret=code)
    )
    if request_db is None or request_db.used:
        raise InvalidTokenException(log_message="Unknown or used authorization code", logger=logger)

    if request_db.expires_at <= datetime.now():
        raise TokenExpiredException(log_message=f"Authorization code of `{request_db.id}` expired", logger=logger)

    if request_db.client_redirect_uri != redirect_uri:
        raise InvalidTokenException(log_message=f"Redirect URI mismatch for `{request_db.id}`", logger=logger)

    code_challenge: str = create_s256_code_challenge(code_verifier)
    if not secrets.compare_digest(code_challenge, request_db.client_code_challenge):
        raise InvalidTokenException(log_message=f"PKCE verification failed for `{request_db.id}`", logger=logger)

    await authorization_request_crud.update_orm(db=db, obj_in={"used": True}, id=request_db.id)

    token: TokenResponse = await token_service.issue_token_pair(db=db, user_id=request_db.user_id)
    return token
