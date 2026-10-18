from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.currency import currency_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.currency import Currency as CurrencyModel
from app.schemas.accounting.currency import Currency
from app.schemas.base import CurrencyCode

logger = get_logger(logger_name=__name__)


async def get_currency(*, db: AsyncSession, code: CurrencyCode) -> Currency:
    currency_db: CurrencyModel | None = await currency_crud.get_or_none(db=db, code=code)
    if currency_db is None:
        raise EntityNotFound(entity=CurrencyModel, search_params={"code": code}, logger=logger)

    currency: Currency = Currency.model_validate(currency_db)
    return currency
