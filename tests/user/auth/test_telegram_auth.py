import base64
from typing import Optional

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.models import User, UserSession, ExternalUser
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.services.user.auth.telegram_client import AuthTelegramClient


def test_get_auth_provider_link():
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()
    auth_link: str = telegram_auth.auth_link
    provider: ProviderType = telegram_auth.provider

    # Then
    assert auth_link == 'fake_telegram_client_id'
    assert provider == ProviderType.TELEGRAM


@pytest.mark.asyncio
async def test_get_token(db_fixture: AsyncSession):
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()

    url = 'https://fibboo-finance.com/login-success'
    telegram_id = '1111111111'
    first_name = 'Sten'
    username = 'stenbot'
    auth_date = 1630578901
    hash = 'ef088ba1ae2cc2118b478381f961e94a67bb6ac6363e5f77d54baef273e70a96'

    code = (f'{url}?id={telegram_id}&first_name={first_name}&username={username}'
            f'&auth_date={auth_date}&hash={hash}').encode('utf-8')

    auth_code = base64.b64encode(code).decode('utf-8')

    # When
    new_token = await telegram_auth.get_token(db=db_fixture, auth_code=auth_code)
    await db_fixture.commit()

    # Then
    user_db: Optional[User] = await user_crud.get_user_by_external_id(db=db_fixture,
                                                                      external_id=telegram_id,
                                                                      provider=ProviderType.TELEGRAM)
    assert user_db is not None
    assert user_db.username == username
    assert user_db.avatar is None
    assert user_db.registration_provider == ProviderType.TELEGRAM
    assert user_db.base_currency == CurrencyType.USD

    user_session_db: Optional[UserSession] = await user_session_crud.get(db=db_fixture, id=new_token)

    assert user_session_db is not None
    assert user_session_db.user_id == user_db.id
    assert user_session_db.id == new_token
    assert user_session_db.provider == ProviderType.TELEGRAM
    assert user_session_db.scope == 'write-message+auth'
    assert user_session_db.token_type == 'telegramHash'

    assert len(user_db.external_users) == 1

    telegram_user_db: ExternalUser = user_db.external_users[0]

    assert telegram_user_db.external_id == telegram_id
    assert telegram_user_db.username == username
    assert telegram_user_db.provider == ProviderType.TELEGRAM
