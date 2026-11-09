from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_user_id
from app.schemas.dictionary import DictionaryItem
from app.services.accounting import currency_service

router = APIRouter()


@router.get("")
async def get_currencies(
    *, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> list[DictionaryItem]:
    """Every currency, the ones the user used in the most transactions of the last 90 days first."""
    currencies: list[DictionaryItem] = await currency_service.get_currencies(db=db, user_id=user_id)
    return currencies
