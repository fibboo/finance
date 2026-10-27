from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Response
from fastapi.responses import RedirectResponse
from starlette import status

from app.api import cookies
from app.api.deps import DbTransaction, get_refresh_token, get_user_id
from app.schemas.user.authorization_request import (
    AuthorizationUrlResponse,
    AuthorizeRequest,
    CallbackRequest,
    LinkCompleteRequest,
    LinkResult,
    MergeRequest,
)
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenPair, TokenRequest, TokenResponse
from app.schemas.user.user import User
from app.services.user import merge_service, token_service
from app.services.user.auth import auth_service

router = APIRouter()


@router.get(
    "/authorize/{provider}",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    response_class=RedirectResponse,
    response_model=None,
)
async def authorize(
    *,
    provider: ProviderType,
    authorize_request: Annotated[AuthorizeRequest, Query()],
    db: DbTransaction,
) -> str:
    """Start signing in with a provider. Redirects to the provider's sign-in page."""
    authorization_url: str = await auth_service.authorize(db=db, provider=provider, authorize_request=authorize_request)
    return authorization_url


@router.post("/link/{provider}")
async def link(
    *,
    provider: ProviderType,
    authorize_request: Annotated[AuthorizeRequest, Query()],
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> AuthorizationUrlResponse:
    """Start linking another provider to the signed-in user. Returns the provider's sign-in URL to open.

    The callback then redirects to the client with a one-time code, or with `error`. The client finishes the link
    with `POST /user/auth/link/{provider}/complete`."""
    authorization_url_response: AuthorizationUrlResponse = await auth_service.start_link(
        db=db, user_id=user_id, provider=provider, authorize_request=authorize_request
    )
    return authorization_url_response


@router.post("/link/{provider}/complete")
async def complete_link(
    *,
    provider: ProviderType,
    data: LinkCompleteRequest,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> LinkResult:
    """Finish linking a provider: present the one-time code from the link callback with its PKCE verifier.

    Answers `linked`, or `merge_required` when the identity belongs to another user. The merge offer then carries a
    merge code valid for 10 minutes and a summary of the other user's account."""
    link_result: LinkResult = await auth_service.complete_link(
        db=db,
        user_id=user_id,
        provider=provider,
        code=data.code,
        redirect_uri=data.redirect_uri,
        code_verifier=data.code_verifier,
    )
    return link_result


@router.post("/merge")
async def merge(*, data: MergeRequest, user_id: UUID = Depends(get_user_id), db: DbTransaction) -> User:
    """Merge the other account of a `merge_required` link into the signed-in user, with the offer's merge code.

    Moves the other user's accounts, locations, transactions and sign-in providers and deletes that user. Same-named
    categories, income sources and locations are folded together, and a same-named money account gets a numeric
    suffix. Answers 409 `BASE_CURRENCY_MISMATCH` when both users have different base currencies and
    `PROVIDER_ALREADY_LINKED` when both have an identity of the same provider."""
    user: User = await merge_service.merge(db=db, user_id=user_id, merge_code=data.merge_code)
    return user


@router.delete("/link/{provider}")
async def unlink(*, provider: ProviderType, user_id: UUID = Depends(get_user_id), db: DbTransaction) -> None:
    """Unlink a provider from the signed-in user. The last linked provider cannot be unlinked."""
    await auth_service.unlink(db=db, user_id=user_id, provider=provider)


@router.get(
    "/callback/{provider}",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    response_class=RedirectResponse,
    response_model=None,
)
async def callback(
    *,
    provider: ProviderType,
    callback_request: Annotated[CallbackRequest, Query()],
    db: DbTransaction,
) -> str:
    """The provider's redirect target. Redirects to the client with a one-time code, or with `error`."""
    redirect_url: str = await auth_service.callback(db=db, provider=provider, callback_request=callback_request)
    return redirect_url


@router.post("/token")
async def token(
    *,
    response: Response,
    data: Annotated[TokenRequest, Form()],
    refresh_token: str | None = Depends(get_refresh_token),
    db: DbTransaction,
) -> TokenResponse:
    """Exchange a one-time code with its PKCE verifier, or the refresh token cookie, for a new access token.

    The new refresh token is set as an HttpOnly cookie. A presented refresh token is revoked."""
    token_pair: TokenPair = await auth_service.grant_token(db=db, token_request=data, refresh_token=refresh_token)
    token_response: TokenResponse = cookies.build_token_response(response=response, token_pair=token_pair)
    return token_response


@router.post("/revoke")
async def revoke(
    *,
    response: Response,
    refresh_token: str | None = Depends(get_refresh_token),
    db: DbTransaction,
) -> None:
    """Revoke the refresh token cookie and every token rotated from it, and clear the cookie.

    Always succeeds, as RFC 7009 requires: an unknown token or a request without the cookie only clears it."""
    await token_service.revoke_refresh_token(db=db, refresh_token=refresh_token)
    cookies.delete_refresh_token_cookie(response=response)
