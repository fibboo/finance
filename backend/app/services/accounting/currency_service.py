from datetime import date, datetime, UTC
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.currency import currency_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.currency import Currency as CurrencyModel
from app.schemas.accounting.currency import Currency
from app.schemas.base import CurrencyCode
from app.schemas.dictionary import DictionaryItem
from app.utils import utils

logger = get_logger(logger_name=__name__)


async def get_currency(*, db: AsyncSession, code: CurrencyCode) -> Currency:
    currency_db: CurrencyModel | None = await currency_crud.get_or_none(db=db, code=code)
    if currency_db is None:
        raise EntityNotFound(entity=CurrencyModel, search_params={"code": code}, logger=logger)

    currency: Currency = Currency.model_validate(currency_db)
    return currency


async def get_currencies(*, db: AsyncSession, user_id: UUID) -> list[DictionaryItem]:
    recent_use_dates: tuple[date, date] = utils.get_recent_use_dates(today=datetime.now(UTC).date())
    currencies_db: list[CurrencyModel] = await currency_crud.get_currencies_by_recent_use(
        db=db, user_id=user_id, recent_use_dates=recent_use_dates
    )
    currencies: list[DictionaryItem] = [
        DictionaryItem(key=currency_db.code, label=currency_db.name) for currency_db in currencies_db
    ]
    return currencies
