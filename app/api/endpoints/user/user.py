from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_transaction, get_user_id
from app.schemas.user.user import BaseCurrencySet, User
from app.services.user import user_service

router = APIRouter()


@router.put("/me/base_currency")
async def set_base_currency(
    *,
    data: BaseCurrencySet,
    user_id: UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db_transaction),
) -> User:
    """Choose the base currency once after the first sign-in. Creates the standard accounts in that currency."""
    user: User = await user_service.set_base_currency(db=db, user_id=user_id, base_currency=data.base_currency)
    return user
