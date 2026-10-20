from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_user_id
from app.schemas.accounting.summary import Summary
from app.services.accounting import summary_service

router = APIRouter()


@router.get("")
async def get_summary(
    *, month: date | None = None, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> Summary:
    """
    The total balance and the earned, spent and left-over amounts of a month, all in the base currency.
    `month` is any date inside the wanted month and defaults to the current month.
    """
    summary: Summary = await summary_service.get_summary(db=db, user_id=user_id, month=month)
    return summary
