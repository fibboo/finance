from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.user.external_user import external_user_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import BaseCurrencyAlreadySet, BaseCurrencyNotSet, IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.user.external_user import ExternalUser as ExternalUserModel
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ExternalUserCreate
from app.schemas.user.identity import ProviderIdentity
from app.schemas.user.user import User, UserCreate
from app.services.accounting import account_service
from app.utils.utils import hash_secret

logger = get_logger(logger_name=__name__)


def _build_fallback_username(*, identity: ProviderIdentity) -> str:
    subject: str = identity.subject if len(identity.subject) <= 32 else hash_secret(secret=identity.subject)[:32]
    fallback_username: str = f"{identity.provider.value.lower()}_{subject}"
    return fallback_username


def build_username(*, identity: ProviderIdentity) -> str:
    if identity.username is not None:
        return identity.username

    username: str = _build_fallback_username(identity=identity)
    return username


async def create_user(*, db: AsyncSession, identity: ProviderIdentity) -> UserModel | None:
    username: str = build_username(identity=identity)
    username_owner_db: UserModel | None = await user_crud.get_or_none(db=db, username=username)
    if username_owner_db is not None and identity.username is not None:
        username = _build_fallback_username(identity=identity)
        username_owner_db = await user_crud.get_or_none(db=db, username=username)

    if username_owner_db is not None:
        logger.warning(f"{identity.provider.value} sign-in rejected: no free username for the new user")
        return None

    user_create = UserCreate(username=username, avatar=identity.avatar, registration_provider=identity.provider)

    try:
        user_db: UserModel = await user_crud.create(db=db, obj_in=user_create)

    except IntegrityError as exc:
        raise IntegrityException(entity=UserModel, exception=exc, logger=logger)

    external_user_db: ExternalUserModel = await add_external_user(
        db=db, user_id=user_db.id, identity=identity, username=build_username(identity=identity)
    )
    user_db.external_users = [external_user_db]

    return user_db


async def add_external_user(
    *, db: AsyncSession, user_id: UUID, identity: ProviderIdentity, username: str
) -> ExternalUserModel:
    external_user_create = ExternalUserCreate(
        user_id=user_id,
        provider=identity.provider,
        external_id=identity.subject,
        username=username,
        first_name=identity.first_name,
        last_name=identity.last_name,
        avatar=identity.avatar,
        email=identity.email,
    )
    external_user_db: ExternalUserModel = await external_user_crud.create(db=db, obj_in=external_user_create)
    return external_user_db


async def set_base_currency(*, db: AsyncSession, user_id: UUID, base_currency: CurrencyType) -> User:
    user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_id)
    if user_db is None:
        raise EntityNotFound(entity=UserModel, search_params={"id": user_id}, logger=logger)

    if user_db.base_currency == base_currency:
        user: User = User.model_validate(user_db)
        return user

    if user_db.base_currency is not None:
        raise BaseCurrencyAlreadySet(user_id=user_id, logger=logger)

    updated_user_db: UserModel | None = await user_crud.update_orm(
        db=db, obj_in={"base_currency": base_currency}, id=user_id, base_currency=None
    )
    if updated_user_db is None:
        raise BaseCurrencyAlreadySet(user_id=user_id, logger=logger)

    await account_service.create_standard_accounts(db=db, user_id=user_id, base_currency=base_currency)

    updated_user: User = User.model_validate(updated_user_db)
    return updated_user


async def get_user_base_currency(*, db: AsyncSession, user_id: UUID) -> CurrencyType:
    user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_id)
    if user_db is None:
        raise EntityNotFound(entity=UserModel, search_params={"id": user_id}, logger=logger)

    if user_db.base_currency is None:
        raise BaseCurrencyNotSet(user_id=user_id, logger=logger)

    return user_db.base_currency
