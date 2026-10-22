from sqlalchemy import select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.currency import Currency
from app.schemas.accounting.currency import Currency as CurrencySchema


class CRUDCurrency(CRUDBase[Currency, CurrencySchema, CurrencySchema]):
    async def get_currencies(self, *, db: AsyncSession) -> list[Currency]:
        query: Select = select(self.model).order_by(self.model.position)
        currencies: list[Currency] = (await db.scalars(query)).all()
        return currencies


currency_crud = CRUDCurrency(model=Currency)
