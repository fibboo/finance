from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.user import user_crud
from app.exceptions.exception import NotFoundException
from app.models import User
from app.schemas.base import CurrencyType


async def get_user_base_currency(db: AsyncSession, user_id: UUID) -> CurrencyType:
    user_db: Optional[User] = await user_crud.get(db=db, id=user_id)
    if user_db is None:
        raise NotFoundException(f'User with id #{user_id} not found')

    return user_db.base_currency
