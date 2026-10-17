from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.cookies import delete_refresh_token_cookie, set_refresh_token_cookie
from app.api.deps import get_db_transaction, get_grant_refresh_token, get_refresh_token
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenPair, TokenRequest, TokenResponse
from app.services.user import token_service
from app.services.user.auth import auth_service

router = APIRouter()


@router.get("/authorize/{provider}")
async def authorize(
    *,
    provider: ProviderType,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: Literal["S256"],
    state: str,
    db: AsyncSession = Depends(get_db_transaction),
) -> RedirectResponse:
    """Start signing in with a provider. Redirects to the provider's sign-in page."""
    authorization_url: str = await auth_service.authorize(
        db=db, provider=provider, redirect_uri=redirect_uri, code_challenge=code_challenge, client_state=state
    )
    response = RedirectResponse(url=authorization_url)
    return response


@router.get("/callback/{provider}")
async def callback(
    *,
    provider: ProviderType,
    state: str,
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db_transaction),
) -> RedirectResponse:
    """The provider's redirect target. Redirects to the client with a one-time code, or with `error`."""
    redirect_url: str = await auth_service.callback(db=db, provider=provider, state=state, code=code, error=error)
    response = RedirectResponse(url=redirect_url)
    return response


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
    if data.grant_type == "authorization_code":
        token_pair: TokenPair = await auth_service.exchange_code(
            db=db,
            code=data.code,
            redirect_uri=data.redirect_uri,
            code_verifier=data.code_verifier,
            refresh_token=refresh_token,
        )
    else:
        token_pair: TokenPair = await token_service.rotate_refresh_token(db=db, refresh_token=refresh_token)

    set_refresh_token_cookie(response=response, refresh_token=token_pair.refresh_token)
    token_response = TokenResponse(
        access_token=token_pair.access_token, token_type="Bearer", expires_in=token_pair.expires_in
    )
    return token_response


@router.post("/revoke")
async def revoke(
    *,
    response: Response,
    refresh_token: str | None = Depends(get_refresh_token),
    db: AsyncSession = Depends(get_db_transaction, scope="function"),
) -> None:
    """Revoke the refresh token cookie and every token rotated from it, and clear the cookie.

    Always succeeds, as RFC 7009 requires: an unknown token or a request without the cookie only clears it."""
    await token_service.revoke_refresh_token(db=db, refresh_token=refresh_token)
    delete_refresh_token_cookie(response=response)
