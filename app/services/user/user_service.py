from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.user.user import user_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.user.user import User
from app.schemas.base import CurrencyType


logger = get_logger(__name__)


async def get_user_base_currency(db: AsyncSession, user_id: UUID) -> CurrencyType:
    user_db: User | None = await user_crud.get_or_none(db=db, id=user_id)
    if user_db is None:
        raise EntityNotFound(entity=User, search_params={'id': user_id}, logger=logger)

    return user_db.base_currency
