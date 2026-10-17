import secrets
from datetime import datetime, timedelta
from uuid import UUID

from authlib.common.urls import add_params_to_uri
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.crud.user.authorization_request import authorization_request_crud
from app.crud.user.external_user import external_user_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import (
    ConflictException,
    IdentityLinkedToAnotherUser,
    LastIdentityUnlinkForbidden,
    ProviderAlreadyLinked,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.temporary_redirect_307 import ClientRedirect
from app.exceptions.unauthorized_401 import InvalidAuthData, InvalidTokenException
from app.exceptions.unprocessable_422 import RedirectUriNotAllowed
from app.models.user.authorization_request import AuthorizationRequest as AuthorizationRequestModel
from app.models.user.external_user import ExternalUser as ExternalUserModel
from app.models.user.user import User as UserModel
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.authorization_request import AuthorizationRequestCreate, AuthorizationRequestUpdate
from app.schemas.user.external_user import ProviderType
from app.schemas.user.identity import ProviderIdentity
from app.schemas.user.token import TokenPair
from app.services.user import token_service, user_service
from app.services.user.auth.oidc_provider import OIDCProvider
from app.services.user.auth.providers import providers
from app.utils.utils import hash_secret

logger = get_logger(logger_name=__name__)

AUTHORIZATION_REQUEST_LIFETIME = timedelta(minutes=10)
AUTHORIZATION_CODE_LIFETIME = timedelta(minutes=1)


def _build_client_url(*, request_db: AuthorizationRequestModel, params: dict[str, str]) -> str:
    client_url: str = add_params_to_uri(request_db.client_redirect_uri, params | {"state": request_db.client_state})
    return client_url


async def _get_verified_code_request(
    *, db: AsyncSession, code: str, redirect_uri: str, code_verifier: str
) -> AuthorizationRequestModel:
    request_db: AuthorizationRequestModel | None = await authorization_request_crud.get_by_code_hash(
        db=db, code_hash=hash_secret(secret=code)
    )
    if request_db is None or request_db.used or request_db.expires_at <= datetime.now():
        raise InvalidTokenException(log_message="Unknown, used or expired authorization code", logger=logger)

    if request_db.client_redirect_uri != redirect_uri:
        raise InvalidTokenException(log_message=f"Redirect URI mismatch for `{request_db.id}`", logger=logger)

    code_challenge: str = create_s256_code_challenge(code_verifier)
    if not secrets.compare_digest(code_challenge, request_db.client_code_challenge):
        raise InvalidTokenException(log_message=f"PKCE verification failed for `{request_db.id}`", logger=logger)

    return request_db


async def authorize(
    *,
    db: AsyncSession,
    provider: ProviderType,
    redirect_uri: str,
    code_challenge: str,
    client_state: str,
    link_user_id: UUID | None = None,
) -> str:
    if redirect_uri not in settings.allowed_redirect_uris:
        raise RedirectUriNotAllowed(redirect_uri=redirect_uri, logger=logger)

    if link_user_id is not None:
        linked_db: ExternalUserModel | None = await external_user_crud.get_or_none(
            db=db, user_id=link_user_id, provider=provider
        )
        if linked_db is not None:
            raise ProviderAlreadyLinked(user_id=link_user_id, provider=provider, logger=logger)

    authorization_request_create = AuthorizationRequestCreate(
        provider=provider,
        state=secrets.token_urlsafe(32),
        nonce=secrets.token_urlsafe(32),
        provider_code_verifier=secrets.token_urlsafe(48),
        client_redirect_uri=redirect_uri,
        client_state=client_state,
        client_code_challenge=code_challenge,
        expires_at=datetime.now() + AUTHORIZATION_REQUEST_LIFETIME,
        link_user_id=link_user_id,
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

    if request_db.code_hash is not None or request_db.used:
        raise InvalidAuthData(log_message=f"Authorization request `{request_db.id}` already completed", logger=logger)

    if request_db.expires_at <= datetime.now():
        raise InvalidAuthData(log_message=f"Authorization request `{request_db.id}` expired", logger=logger)

    if error is not None or code is None:
        error_code: str = error if error is not None else "invalid_request"
        error_url: str = _build_client_url(request_db=request_db, params={"error": error_code})
        return error_url

    oidc_provider: OIDCProvider = providers[provider]
    identity: ProviderIdentity | None = await oidc_provider.fetch_identity(
        code=code, code_verifier=request_db.provider_code_verifier, nonce=request_db.nonce
    )
    server_error_url: str = _build_client_url(request_db=request_db, params={"error": "server_error"})
    if identity is None:
        return server_error_url

    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id=identity.subject, provider=provider
    )
    is_link: bool = request_db.link_user_id is not None
    if is_link and user_db is not None and user_db.id != request_db.link_user_id:
        await authorization_request_crud.update_orm(
            db=db, obj_in={"used": True, "link_identity": None}, id=request_db.id
        )
        error_url: str = _build_client_url(
            request_db=request_db, params={"error": ErrorCodeType.IDENTITY_LINKED_TO_ANOTHER_USER.value}
        )
        return error_url

    if not is_link and user_db is None:
        try:
            user_db: UserModel | None = await user_service.create_user(db=db, identity=identity)

        except ConflictException as exc:
            raise ClientRedirect(url=server_error_url, exception=exc)

        if user_db is None:
            return server_error_url

    authorization_code: str = secrets.token_urlsafe(32)
    authorization_request_update = AuthorizationRequestUpdate(
        user_id=None if is_link else user_db.id,
        link_identity=identity.model_dump(mode="json") if is_link else None,
        code_hash=hash_secret(secret=authorization_code),
        expires_at=datetime.now() + AUTHORIZATION_CODE_LIFETIME,
    )
    await authorization_request_crud.update_orm(db=db, obj_in=authorization_request_update, id=request_db.id)

    redirect_url: str = _build_client_url(request_db=request_db, params={"code": authorization_code})
    return redirect_url


async def exchange_code(
    *, db: AsyncSession, code: str, redirect_uri: str, code_verifier: str, refresh_token: str | None = None
) -> TokenPair:
    request_db: AuthorizationRequestModel = await _get_verified_code_request(
        db=db, code=code, redirect_uri=redirect_uri, code_verifier=code_verifier
    )
    if request_db.link_user_id is not None:
        raise InvalidTokenException(
            log_message=f"Authorization code of `{request_db.id}` is a link code", logger=logger
        )

    await authorization_request_crud.update_orm(db=db, obj_in={"used": True}, id=request_db.id)

    if refresh_token is not None:
        await token_service.revoke_refresh_token(db=db, refresh_token=refresh_token)

    token: TokenPair = await token_service.issue_token_pair(db=db, user_id=request_db.user_id)
    return token


async def complete_link(
    *, db: AsyncSession, user_id: UUID, provider: ProviderType, code: str, redirect_uri: str, code_verifier: str
) -> None:
    request_db: AuthorizationRequestModel = await _get_verified_code_request(
        db=db, code=code, redirect_uri=redirect_uri, code_verifier=code_verifier
    )
    if request_db.link_user_id != user_id or request_db.provider != provider:
        raise InvalidTokenException(log_message=f"Link code of `{request_db.id}` is not for this link", logger=logger)

    identity: ProviderIdentity = ProviderIdentity.model_validate(request_db.link_identity)
    await authorization_request_crud.update_orm(db=db, obj_in={"used": True, "link_identity": None}, id=request_db.id)

    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id=identity.subject, provider=provider
    )
    if user_db is not None and user_db.id != user_id:
        raise IdentityLinkedToAnotherUser(user_id=user_id, provider=provider, logger=logger)

    if user_db is not None:
        return

    linked_db: ExternalUserModel | None = await external_user_crud.get_or_none(
        db=db, user_id=user_id, provider=provider
    )
    if linked_db is not None:
        raise ProviderAlreadyLinked(user_id=user_id, provider=provider, logger=logger)

    username: str = user_service.build_username(identity=identity)
    await user_service.add_external_user(db=db, user_id=user_id, identity=identity, username=username)


async def unlink(*, db: AsyncSession, user_id: UUID, provider: ProviderType) -> None:
    external_users_db: list[ExternalUserModel] = await external_user_crud.get_by_user_for_update(db=db, user_id=user_id)
    linked_providers: list[ProviderType] = [external_user.provider for external_user in external_users_db]
    if provider not in linked_providers:
        raise EntityNotFound(
            entity=ExternalUserModel, search_params={"user_id": user_id, "provider": provider}, logger=logger
        )

    if len(linked_providers) == 1:
        raise LastIdentityUnlinkForbidden(user_id=user_id, provider=provider, logger=logger)

    await external_user_crud.delete_by_user_and_provider(db=db, user_id=user_id, provider=provider)
