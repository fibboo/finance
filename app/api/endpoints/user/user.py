from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import DbTransaction, get_user_id
from app.schemas.user.user import BaseCurrencySet, User
from app.services.user import user_service

router = APIRouter()


@router.put("/me/base_currency")
async def set_base_currency(
    *,
    data: BaseCurrencySet,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> User:
    """Choose the base currency once after the first sign-in. Creates the standard accounts in that currency."""
    user: User = await user_service.set_base_currency(db=db, user_id=user_id, base_currency=data.base_currency)
    return user
