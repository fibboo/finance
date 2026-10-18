from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_transaction
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenRequest, TokenResponse
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
    *, data: Annotated[TokenRequest, Form()], db: AsyncSession = Depends(get_db_transaction)
) -> TokenResponse:
    """Exchange a one-time code with its PKCE verifier, or a refresh token, for a new token pair.

    A presented refresh token is revoked."""
    if data.grant_type == "authorization_code":
        token_response: TokenResponse = await auth_service.exchange_code(
            db=db, code=data.code, redirect_uri=data.redirect_uri, code_verifier=data.code_verifier
        )
    else:
        token_response: TokenResponse = await token_service.rotate_refresh_token(
            db=db, refresh_token=data.refresh_token
        )

    return token_response


@router.post("/revoke")
async def revoke(*, refresh_token: str = Form(), db: AsyncSession = Depends(get_db_transaction)) -> None:
    """Revoke a refresh token and every token rotated from it. Always succeeds, as RFC 7009 requires."""
    await token_service.revoke_refresh_token(db=db, refresh_token=refresh_token)
