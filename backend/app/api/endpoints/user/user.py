from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_db, get_user_id
from app.schemas.user.user import BaseCurrencySet, User
from app.services.user import user_service

router = APIRouter()


@router.get("/me")
async def get_me(*, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)) -> User:
    """The signed-in user with the linked providers. A null `base_currency` means onboarding is not finished yet."""
    user: User = await user_service.get_user(db=db, user_id=user_id)
    return user


@router.put("/me/base_currency")
async def set_base_currency(
    *,
    data: BaseCurrencySet,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> User:
    """Choose the base currency once after the first sign-in. Creates the Wallet account in that currency."""
    user: User = await user_service.set_base_currency(db=db, user_id=user_id, base_currency=data.base_currency)
    return user
