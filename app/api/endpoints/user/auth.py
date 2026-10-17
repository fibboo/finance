from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import cookies
from app.api.deps import get_db_transaction, get_grant_refresh_token, get_required_refresh_token, get_user_id
from app.schemas.user.authorization_request import (
    AuthorizationUrlResponse,
    AuthorizeRequest,
    CallbackRequest,
    LinkCompleteRequest,
)
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenPair, TokenRequest, TokenResponse
from app.services.user import token_service
from app.services.user.auth import auth_service

router = APIRouter()


@router.get("/authorize/{provider}", response_class=RedirectResponse)
async def authorize(
    *,
    provider: ProviderType,
    authorize_request: Annotated[AuthorizeRequest, Query()],
    db: AsyncSession = Depends(get_db_transaction),
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
    db: AsyncSession = Depends(get_db_transaction),
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
    db: AsyncSession = Depends(get_db_transaction),
) -> None:
    """Finish linking a provider: present the one-time code from the link callback with its PKCE verifier."""
    await auth_service.complete_link(
        db=db,
        user_id=user_id,
        provider=provider,
        code=data.code,
        redirect_uri=data.redirect_uri,
        code_verifier=data.code_verifier,
    )


@router.delete("/link/{provider}")
async def unlink(
    *, provider: ProviderType, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db_transaction)
) -> None:
    """Unlink a provider from the signed-in user. The last linked provider cannot be unlinked."""
    await auth_service.unlink(db=db, user_id=user_id, provider=provider)


@router.get("/callback/{provider}", response_class=RedirectResponse)
async def callback(
    *,
    provider: ProviderType,
    callback_request: Annotated[CallbackRequest, Query()],
    db: AsyncSession = Depends(get_db_transaction),
) -> str:
    """The provider's redirect target. Redirects to the client with a one-time code, or with `error`."""
    redirect_url: str = await auth_service.callback(db=db, provider=provider, callback_request=callback_request)
    return redirect_url


@router.post("/token")
async def token(
    *,
    response: Response,
    data: Annotated[TokenRequest, Form()],
    refresh_token: str | None = Depends(get_grant_refresh_token),
    db: AsyncSession = Depends(get_db_transaction, scope="function"),
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
    refresh_token: str = Depends(get_required_refresh_token),
    db: AsyncSession = Depends(get_db_transaction, scope="function"),
) -> None:
    """Revoke the refresh token cookie and every token rotated from it, and clear the cookie.

    An unknown token succeeds, as RFC 7009 requires. A request without the cookie answers 401."""
    await token_service.revoke_refresh_token(db=db, refresh_token=refresh_token)
    cookies.delete_refresh_token_cookie(response=response)
