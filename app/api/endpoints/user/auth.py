from typing import Literal

from fastapi import APIRouter, Depends, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_transaction
from app.schemas.user.token import TokenResponse
from app.services.user import token_service

router = APIRouter()


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
