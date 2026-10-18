import hashlib
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.accounting.category import category_crud
from app.crud.user.external_user import external_user_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import (
    BaseCurrencyAlreadySet,
    BaseCurrencyNotSet,
    IdentityLinkedToAnotherUser,
    ProviderAlreadyLinked,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.category import Category as CategoryModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountType
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ExternalUserCreate, ProviderType
from app.schemas.user.identity import ProviderIdentity
from app.schemas.user.user import User, UserCreate
from app.services.user.user_service import (
    add_external_user,
    create_user,
    get_user,
    get_user_base_currency,
    set_base_currency,
)


async def test_create_user_without_base_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        external_id="1111111111",
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
        external_id="1111111111",
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


@pytest.mark.parametrize(
    "username, avatar, expected_username, expected_avatar",
    [
        (
            "jd",
            "https://t.me/i/userpic/320/johndoe.jpg",
            "telegram_1111111111",
            "https://t.me/i/userpic/320/johndoe.jpg",
        ),
        ("j" * 65, "ab", "telegram_1111111111", None),
        ("johndoe", "https://t.me/" + "p" * 2560, "johndoe", None),
    ],
    ids=["username_too_short", "username_too_long_and_avatar_too_short", "avatar_too_long"],
)
async def test_create_user_profile_out_of_bounds(
    db: AsyncSession,
    db_transaction: AsyncSession,
    username: str,
    avatar: str,
    expected_username: str,
    expected_avatar: str | None,
):
    # Arrange
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        external_id="1111111111",
        username=username,
        first_name="Sten",
        last_name=None,
        avatar=avatar,
        email=None,
    )

    # Act
    user_db: UserModel | None = await create_user(db=db_transaction, identity=identity)
    await db_transaction.commit()

    # Assert
    # a username users.username cannot hold falls back, and an avatar users.avatar cannot hold is dropped
    created_user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_db.id)
    assert created_user_db.username == expected_username
    assert created_user_db.avatar == expected_avatar
    assert created_user_db.external_users[0].username == username
    assert created_user_db.external_users[0].avatar == avatar


async def test_create_user_long_external_id(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    external_id: str = "1" * 100
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        external_id=external_id,
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
    assert created_user_db.username == f"telegram_{hashlib.sha256(external_id.encode()).hexdigest()[:32]}"
    assert created_user_db.external_users[0].username == created_user_db.username
    assert created_user_db.external_users[0].external_id == external_id


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
        external_id="1111111111",
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

    categories_db: list[CategoryModel] = await category_crud.get_batch(db=db, user_id=user_db.id)
    assert len(categories_db) == 1
    assert categories_db[0].name == "General"


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

    categories_db: list[CategoryModel] = await category_crud.get_batch(db=db, user_id=user_db.id)
    assert len(categories_db) == 0


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

    categories_db: list[CategoryModel] = await category_crud.get_batch(db=db, user_id=user_db.id)
    assert len(categories_db) == 0


@pytest.mark.parametrize("base_currency", [CurrencyType.USD, None], ids=["onboarded", "not_onboarded"])
async def test_get_user(db: AsyncSession, base_currency: CurrencyType | None):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency=base_currency)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    external_user_create = ExternalUserCreate(
        user_id=user_db.id, provider=ProviderType.TELEGRAM, external_id="1111111111", username="test"
    )
    await external_user_crud.create(db=db, obj_in=external_user_create, commit=True)
    db.expunge_all()

    # Act
    user: User = await get_user(db=db, user_id=user_db.id)

    # Assert
    assert user.id == user_db.id
    assert user.username == "test"
    assert user.base_currency == base_currency
    assert len(user.external_users) == 1
    assert user.external_users[0].provider == ProviderType.TELEGRAM
    assert user.external_users[0].external_id == "1111111111"


async def test_get_user_not_found(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await get_user(db=db, user_id=user_id)

    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


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


@pytest.mark.parametrize(
    "user_index, external_id, expected_exception",
    [(2, "1111111111", IdentityLinkedToAnotherUser), (0, "2222222222", ProviderAlreadyLinked)],
    ids=["identity_of_another_user", "provider_already_linked"],
)
async def test_add_external_user_conflict(
    db: AsyncSession, db_transaction: AsyncSession, user_index: int, external_id: str, expected_exception: type
):
    # Arrange
    # stenbot already has a Telegram identity, janedoe owns Telegram identity 1111111111, johndoe has none
    users_db: list[UserModel] = await user_crud.create_batch(
        db=db,
        objs_in=[
            UserCreate(username="stenbot", registration_provider=ProviderType.TELEGRAM),
            UserCreate(username="janedoe", registration_provider=ProviderType.TELEGRAM),
            UserCreate(username="johndoe", registration_provider=ProviderType.GOOGLE),
        ],
        commit=True,
    )
    await external_user_crud.create_batch(
        db=db,
        objs_in=[
            {
                "user_id": users_db[0].id,
                "provider": ProviderType.TELEGRAM,
                "external_id": "3333333333",
                "username": "stenbot",
            },
            {
                "user_id": users_db[1].id,
                "provider": ProviderType.TELEGRAM,
                "external_id": "1111111111",
                "username": "janedoe",
            },
        ],
        commit=True,
    )
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        external_id=external_id,
        username="stenbot",
        first_name=None,
        last_name=None,
        avatar=None,
        email=None,
    )

    # Act / Assert
    with pytest.raises(expected_exception) as exc:
        await add_external_user(
            db=db_transaction, user_id=users_db[user_index].id, identity=identity, username="stenbot"
        )

    assert exc.value.status_code == status.HTTP_409_CONFLICT
