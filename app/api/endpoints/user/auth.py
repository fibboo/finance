from typing import Literal

from fastapi import APIRouter, Depends, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_transaction
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenResponse
from app.services.user import token_service
from app.services.user.auth.auth_client import AuthClient
from app.services.user.auth.telegram_client import AuthTelegramClient
from app.services.user.auth.test_client import AuthTestClient

router = APIRouter()

auth_clients: dict[ProviderType, AuthClient] = {
    ProviderType.TELEGRAM: AuthTelegramClient(),
    ProviderType.TEST: AuthTestClient(),
}


@router.get("/route")
async def get_auth_url(*, provider: ProviderType):
    client: AuthClient = auth_clients[provider]
    auth_url: str = client.auth_link
    return auth_url


@router.post("/register")
async def register(
    *,
    provider: ProviderType,
    base_currency: CurrencyType,
    auth_code: str,
    db: AsyncSession = Depends(get_db_transaction),
) -> TokenResponse:
    client: AuthClient = auth_clients[provider]
    token: TokenResponse = await client.register(db=db, auth_code=auth_code, base_currency=base_currency)
    return token


@router.post("/login")
async def login(
    *, provider: ProviderType, auth_code: str, db: AsyncSession = Depends(get_db_transaction)
) -> TokenResponse:
    client: AuthClient = auth_clients[provider]
    token: TokenResponse = await client.login(db=db, auth_code=auth_code)
    return token


@router.post("/token")
async def refresh_token_grant(
    *,
    grant_type: Literal["refresh_token"] = Form(),
    refresh_token: str = Form(),
    db: AsyncSession = Depends(get_db_transaction),
) -> TokenResponse:
    """Exchange a refresh token for a new token pair. The presented refresh token is revoked."""
    token: TokenResponse = await token_service.rotate_refresh_token(db=db, refresh_token=refresh_token)
    return token


@router.post("/revoke")
async def revoke(*, refresh_token: str = Form(), db: AsyncSession = Depends(get_db_transaction)) -> None:
    """Revoke a refresh token and every token rotated from it. Always succeeds, as RFC 7009 requires."""
    await token_service.revoke_refresh_token(db=db, refresh_token=refresh_token)
