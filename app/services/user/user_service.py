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
from app.schemas.user.session import AuthData
from app.schemas.user.user import User, UserCreate
from app.services.accounting import account_service

logger = get_logger(logger_name=__name__)


async def create_user(*, db: AsyncSession, auth_data: AuthData) -> UserModel:
    user_create = UserCreate(
        username=auth_data.username,
        avatar=auth_data.avatar,
        registration_provider=auth_data.provider,
    )

    try:
        user_db: UserModel = await user_crud.create(db=db, obj_in=user_create)

    except IntegrityError as exc:
        raise IntegrityException(entity=UserModel, exception=exc, logger=logger)

    external_user_create = ExternalUserCreate(
        user_id=user_db.id,
        provider=auth_data.provider,
        external_id=auth_data.external_id,
        username=auth_data.username,
        first_name=auth_data.first_name,
        last_name=auth_data.last_name,
        avatar=auth_data.avatar,
        profile_url=auth_data.profile_url,
        email=auth_data.email,
    )
    external_user_db: ExternalUserModel = await external_user_crud.create(db=db, obj_in=external_user_create)
    user_db.external_users = [external_user_db]

    return user_db


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
