from typing import Optional
from uuid import UUID

from aiocache import cached
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.user import user_crud
from app.exceptions.exception import NotFoundException
from app.models.user.user import User
from app.schemas.base import CurrencyType


@cached(ttl=60 * 5,
        key_builder=lambda *args, **kwargs: f'get_user_base_currency_{kwargs["user_id"] if kwargs else args[1]}',
        namespace=__name__)
async def get_user_base_currency(db: AsyncSession, user_id: UUID) -> CurrencyType:
    user_db: Optional[User] = await user_crud.get(db=db, id=user_id)
    if user_db is None:
        raise NotFoundException(f'User with id #{user_id} not found')

    return user_db.base_currency
