import hashlib

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import BaseCurrencyAlreadySet, BaseCurrencyNotSet
from app.models.accounting.account import Account as AccountModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountType
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.identity import ProviderIdentity
from app.schemas.user.user import User, UserCreate
from app.services.user.user_service import create_user, get_user_base_currency, set_base_currency


async def test_create_user_without_base_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        subject="1111111111",
        username="stenbot",
        first_name="Sten",
        last_name=None,
        avatar=None,
        email=None,
    )

    # Act
    user_db: UserModel = await create_user(db=db_transaction, identity=identity)
    await db_transaction.commit()

    # Assert
    created_user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_db.id)
    assert created_user_db is not None
    assert created_user_db.username == "stenbot"
    assert created_user_db.base_currency is None
    assert len(created_user_db.external_users) == 1
    assert created_user_db.external_users[0].external_id == "1111111111"

    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db, user_id=user_db.id)
    assert len(accounts_db) == 0


async def test_create_user_username_taken(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    await user_crud.create(
        db=db, obj_in=UserCreate(username="stenbot", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        subject="1111111111",
        username="stenbot",
        first_name="Sten",
        last_name=None,
        avatar=None,
        email=None,
    )

    # Act
    user_db: UserModel | None = await create_user(db=db_transaction, identity=identity)
    await db_transaction.commit()

    # Assert
    created_user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_db.id)
    assert created_user_db.username == "telegram_1111111111"
    assert created_user_db.external_users[0].username == "stenbot"


async def test_create_user_long_subject(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    subject: str = "1" * 100
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        subject=subject,
        username=None,
        first_name="Sten",
        last_name=None,
        avatar=None,
        email=None,
    )

    # Act
    user_db: UserModel | None = await create_user(db=db_transaction, identity=identity)
    await db_transaction.commit()

    # Assert
    created_user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_db.id)
    assert created_user_db.username == f"telegram_{hashlib.sha256(subject.encode()).hexdigest()[:32]}"
    assert created_user_db.external_users[0].username == created_user_db.username
    assert created_user_db.external_users[0].external_id == subject


async def test_create_user_no_free_username(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    await user_crud.create_batch(
        db=db,
        objs_in=[
            UserCreate(username="stenbot", registration_provider=ProviderType.TELEGRAM),
            UserCreate(username="telegram_1111111111", registration_provider=ProviderType.TELEGRAM),
        ],
        commit=True,
    )
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        subject="1111111111",
        username="stenbot",
        first_name="Sten",
        last_name=None,
        avatar=None,
        email=None,
    )

    # Act
    user_db: UserModel | None = await create_user(db=db_transaction, identity=identity)
    await db_transaction.commit()

    # Assert
    assert user_db is None

    users_db: list[UserModel] = await user_crud.get_batch(db=db)
    assert len(users_db) == 2


async def test_set_base_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act
    user: User = await set_base_currency(db=db_transaction, user_id=user_db.id, base_currency=CurrencyType.EUR)
    await db_transaction.commit()

    # Assert
    assert user.id == user_db.id
    assert user.base_currency == CurrencyType.EUR

    await db.refresh(user_db)
    assert user_db.base_currency == CurrencyType.EUR

    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db, user_id=user_db.id)
    assert len(accounts_db) == len(AccountType)
    assert {account_db.account_type for account_db in accounts_db} == set(AccountType)
    for account_db in accounts_db:
        assert account_db.currency == CurrencyType.EUR


async def test_set_base_currency_already_set(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency=CurrencyType.USD
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act / Assert
    with pytest.raises(BaseCurrencyAlreadySet) as exc:
        await set_base_currency(db=db_transaction, user_id=user_db.id, base_currency=CurrencyType.EUR)

    await db_transaction.rollback()

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_ALREADY_SET
    assert exc.value.log_level == LogLevelType.ERROR

    await db.refresh(user_db)
    assert user_db.base_currency == CurrencyType.USD

    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db, user_id=user_db.id)
    assert len(accounts_db) == 0


async def test_set_base_currency_same_currency_again(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency=CurrencyType.USD
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act
    user: User = await set_base_currency(db=db_transaction, user_id=user_db.id, base_currency=CurrencyType.USD)
    await db_transaction.commit()

    # Assert
    assert user.id == user_db.id
    assert user.base_currency == CurrencyType.USD

    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db, user_id=user_db.id)
    assert len(accounts_db) == 0


async def test_get_user_base_currency(db: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(
        username="test", registration_provider=ProviderType.TELEGRAM, base_currency=CurrencyType.USD
    )
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    await db.commit()

    # Act
    base_currency: CurrencyType = await get_user_base_currency(db=db, user_id=user_db.id)

    # Assert
    assert base_currency == CurrencyType.USD


async def test_get_user_base_currency_not_set(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act / Assert
    with pytest.raises(BaseCurrencyNotSet) as exc:
        await get_user_base_currency(db=db_transaction, user_id=user_db.id)

    await db_transaction.rollback()

    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.error_code == ErrorCodeType.BASE_CURRENCY_NOT_SET
    assert exc.value.log_level == LogLevelType.INFO
