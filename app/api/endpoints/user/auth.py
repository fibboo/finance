from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_token
from app.schemas.user.external_user import ProviderType
from app.services.user import session_service
from app.services.user.auth.auth_client import AuthClient
from app.services.user.auth.telegram_client import AuthTelegramClient
from app.services.user.auth.test_client import AuthTestClient

router = APIRouter()

auth_clients: dict[ProviderType, AuthClient] = {ProviderType.TELEGRAM: AuthTelegramClient(),
                                                ProviderType.TEST: AuthTestClient()}


@router.get('/route')
async def get_auth_url(provider: ProviderType):
    client: AuthClient = auth_clients[provider]
    auth_url: str = client.auth_link
    return auth_url


@router.get('/login')
async def login(provider: ProviderType,
                auth_code: str,
                db: AsyncSession = Depends(get_db)):
    client: AuthClient = auth_clients[provider]
    token: UUID = await client.get_token(db=db, auth_code=auth_code)
    return token


@router.post('/logout')
async def logout(db: AsyncSession = Depends(get_db),
                 x_auth_token: UUID = Depends(get_token)):
    await session_service.revoke_session(db=db, token=x_auth_token)
