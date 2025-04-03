from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_transaction, get_token
from app.schemas.base import CurrencyType
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


@router.post('/register')
async def register(provider: ProviderType,
                   base_currency: CurrencyType,
                   auth_code: str,
                   db: AsyncSession = Depends(get_db_transaction)):
    client: AuthClient = auth_clients[provider]
    token: UUID = await client.register(db=db, auth_code=auth_code, base_currency=base_currency)
    return token


@router.post('/login')
async def login(provider: ProviderType,
                auth_code: str,
                db: AsyncSession = Depends(get_db_transaction)):
    client: AuthClient = auth_clients[provider]
    token: UUID = await client.login(db=db, auth_code=auth_code)
    return token


@router.post('/logout')
async def logout(x_auth_token: UUID = Depends(get_token),
                 db: AsyncSession = Depends(get_db_transaction)):
    await session_service.revoke_session(db=db, token=x_auth_token)
