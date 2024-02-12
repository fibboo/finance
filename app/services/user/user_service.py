from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.base import CurrencyType


async def get_user_base_currency(db: AsyncSession, user_id: UUID) -> CurrencyType:
    return CurrencyType.USD
