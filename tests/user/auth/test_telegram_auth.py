import base64
from datetime import timedelta
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.configs.settings import telegram_settings
from app.crud.accounting.account import account_crud
from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models import Account as AccountModel
from app.models.user.external_user import ExternalUser as ExternalUserModel
from app.models.user.session import Session as SessionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountType
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.services.user.auth.telegram_client import AuthTelegramClient


def test_get_auth_provider_link():
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()
    auth_link: str = telegram_auth.auth_link
    provider: ProviderType = telegram_auth.provider

    # Then
    assert auth_link == telegram_settings.bot_name
    assert provider == ProviderType.TELEGRAM


@pytest.mark.asyncio
async def test_register_new_user_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()

    url = 'https://fibboo-finance.com/login-success'
    telegram_id = '1111111111'
    first_name = 'Sten'
    username = 'stenbot'
    auth_date = 1630578901
    hash_ = 'ef088ba1ae2cc2118b478381f961e94a67bb6ac6363e5f77d54baef273e70a96'

    code = (f'{url}?id={telegram_id}&first_name={first_name}&username={username}'
            f'&auth_date={auth_date}&hash={hash_}').encode('utf-8')

    auth_code = base64.b64encode(code).decode('utf-8')

    base_currency: CurrencyType = CurrencyType.EUR

    # When
    new_token: UUID = await telegram_auth.register(db=db_transaction, auth_code=auth_code, base_currency=base_currency)
    await db_transaction.commit()

    # Then
    user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                        external_id=telegram_id,
                                                                        provider=ProviderType.TELEGRAM)
    assert user_db is not None
    assert user_db.username == username
    assert user_db.avatar is None
    assert user_db.registration_provider == ProviderType.TELEGRAM
    assert user_db.base_currency == base_currency

    user_session_db: SessionModel | None = await user_session_crud.get_or_none(db=db, id=new_token)
    assert user_session_db is not None
    assert user_session_db.user_id == user_db.id
    assert user_session_db.id == new_token
    assert user_session_db.provider == ProviderType.TELEGRAM
    assert user_session_db.scope == 'write-message+auth'
    assert user_session_db.token_type == 'telegramHash'

    assert len(user_db.external_users) == 1
    telegram_user_db: ExternalUserModel = user_db.external_users[0]
    assert telegram_user_db.external_id == telegram_id
    assert telegram_user_db.username == username
    assert telegram_user_db.provider == ProviderType.TELEGRAM

    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db)
    account_types: list[AccountType] = [account_type for account_type in AccountType]
    current_account_types: list[AccountType] = []
    for account_db in accounts_db:
        current_account_types.append(account_db.account_type)
        assert account_db.user_id == user_db.id
        assert account_db.currency == base_currency
    assert len(current_account_types) == len(account_types)
    assert set(current_account_types) == set(account_types)


@pytest.mark.asyncio
async def test_register_user_exists_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()

    url = 'https://fibboo-finance.com/login-success'
    telegram_id = '1111111111'
    first_name = 'Sten'
    username = 'stenbot'
    auth_date = 1630578901
    hash_ = 'ef088ba1ae2cc2118b478381f961e94a67bb6ac6363e5f77d54baef273e70a96'

    code = (f'{url}?id={telegram_id}&first_name={first_name}&username={username}'
            f'&auth_date={auth_date}&hash={hash_}').encode('utf-8')

    auth_code = base64.b64encode(code).decode('utf-8')

    base_currency_before: CurrencyType = CurrencyType.EUR
    await telegram_auth.register(db=db, auth_code=auth_code, base_currency=base_currency_before)
    await db.commit()

    base_currency: CurrencyType = CurrencyType.USD

    # When
    await telegram_auth.register(db=db_transaction, auth_code=auth_code, base_currency=base_currency)
    await db_transaction.commit()

    # Then
    user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                        external_id=telegram_id,
                                                                        provider=ProviderType.TELEGRAM)
    assert user_db is not None
    assert user_db.username == username
    assert user_db.avatar is None
    assert user_db.registration_provider == ProviderType.TELEGRAM
    assert user_db.base_currency == base_currency_before

    user_sessions_db: list[SessionModel] = await user_session_crud.get_batch(db=db)
    assert len(user_sessions_db) == 1

    assert len(user_db.external_users) == 1
    telegram_user_db: ExternalUserModel = user_db.external_users[0]
    assert telegram_user_db.external_id == telegram_id
    assert telegram_user_db.username == username
    assert telegram_user_db.provider == ProviderType.TELEGRAM

    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db)
    account_types: list[AccountType] = [account_type for account_type in AccountType]
    current_account_types: list[AccountType] = []
    for account_db in accounts_db:
        current_account_types.append(account_db.account_type)
        assert account_db.user_id == user_db.id
        assert account_db.currency == base_currency_before
    assert len(current_account_types) == len(account_types)
    assert set(current_account_types) == set(account_types)


@pytest.mark.asyncio
async def test_register_login_ok(db: AsyncSession):
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()

    url = 'https://fibboo-finance.com/login-success'
    telegram_id = '1111111111'
    first_name = 'Sten'
    username = 'stenbot'
    auth_date = 1630578901
    hash_ = 'ef088ba1ae2cc2118b478381f961e94a67bb6ac6363e5f77d54baef273e70a96'

    code = (f'{url}?id={telegram_id}&first_name={first_name}&username={username}'
            f'&auth_date={auth_date}&hash={hash_}').encode('utf-8')

    auth_code = base64.b64encode(code).decode('utf-8')

    base_currency: CurrencyType = CurrencyType.EUR
    await telegram_auth.register(db=db, auth_code=auth_code, base_currency=base_currency)
    await db.commit()

    # When
    await telegram_auth.login(db=db, auth_code=auth_code)

    # Then
    user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                        external_id=telegram_id,
                                                                        provider=ProviderType.TELEGRAM)
    assert user_db is not None
    assert len(user_db.external_users) == 1

    user_sessions_db: list[SessionModel] = await user_session_crud.get_batch(db=db)
    assert len(user_sessions_db) == 1


@pytest.mark.asyncio
async def test_register_login_no_active_session_ok(db: AsyncSession):
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()

    url = 'https://fibboo-finance.com/login-success'
    telegram_id = '1111111111'
    first_name = 'Sten'
    username = 'stenbot'
    auth_date = 1630578901
    hash_ = 'ef088ba1ae2cc2118b478381f961e94a67bb6ac6363e5f77d54baef273e70a96'

    code = (f'{url}?id={telegram_id}&first_name={first_name}&username={username}'
            f'&auth_date={auth_date}&hash={hash_}').encode('utf-8')

    auth_code = base64.b64encode(code).decode('utf-8')

    base_currency: CurrencyType = CurrencyType.EUR
    await telegram_auth.register(db=db, auth_code=auth_code, base_currency=base_currency)

    user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                        external_id=telegram_id,
                                                                        provider=ProviderType.TELEGRAM)
    session_db: SessionModel = await user_session_crud.get(db=db, user_id=user_db.id)
    session_db.expires_at = session_db.expires_at - timedelta(days=99)
    db.add(session_db)
    await db.commit()

    # When
    await telegram_auth.login(db=db, auth_code=auth_code)

    # Then
    user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                        external_id=telegram_id,
                                                                        provider=ProviderType.TELEGRAM)
    assert user_db is not None
    assert len(user_db.external_users) == 1

    user_sessions_db: list[SessionModel] = await user_session_crud.get_batch(db=db)
    assert len(user_sessions_db) == 2


@pytest.mark.asyncio
async def test_register_login_user_not_found(db: AsyncSession):
    # Given
    telegram_auth: AuthTelegramClient = AuthTelegramClient()

    url = 'https://fibboo-finance.com/login-success'
    telegram_id = '1111111111'
    first_name = 'Sten'
    username = 'stenbot'
    auth_date = 1630578901
    hash_ = 'ef088ba1ae2cc2118b478381f961e94a67bb6ac6363e5f77d54baef273e70a96'

    code = (f'{url}?id={telegram_id}&first_name={first_name}&username={username}'
            f'&auth_date={auth_date}&hash={hash_}').encode('utf-8')

    auth_code = base64.b64encode(code).decode('utf-8')

    # When
    with pytest.raises(EntityNotFound) as exc:
        await telegram_auth.login(db=db, auth_code=auth_code)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == 'Entity not found'
    search_params = {'external_id': telegram_id, 'provider': ProviderType.TELEGRAM.value}
    assert exc.value.log_message == f'{UserModel.__name__} not found by {search_params}'
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    users_db: list[UserModel] = (await db.scalars(select(UserModel))).all()
    assert len(users_db) == 0
