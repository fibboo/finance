import time
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

import httpx
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import exchange_rate_settings
from app.crud.user.user import user_crud
from app.models.user.user import User as UserModel
from app.schemas.accounting.exchange_rate import ExchangeRates
from app.schemas.base import CurrencyCode
from app.utils import utils

logger = get_logger(logger_name=__name__)

REQUEST_TIMEOUT_SECONDS: float = 5
RETRY_SECONDS: int = 300


@dataclass
class ExchangeRatesCache:
    usd_rates: dict[str, Decimal] = field(default_factory=dict)
    next_fetch_at: float | None = None


exchange_rates_cache = ExchangeRatesCache()


async def _fetch_usd_rates() -> dict[str, Decimal] | None:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response: httpx.Response = await client.get(exchange_rate_settings.url)
            response.raise_for_status()

        exchange_rates: ExchangeRates = ExchangeRates.model_validate_json(response.content)

    except (httpx.HTTPError, ValidationError) as exc:
        logger.warning(f"Exchange rates unavailable: {type(exc).__name__} {exc}")
        return None

    return exchange_rates.rates


async def get_base_currency_rates(*, db: AsyncSession, user_id: UUID) -> dict[CurrencyCode, Decimal]:
    user_db: UserModel | None = await user_crud.get_or_none(db=db, id=user_id)
    if user_db is None or user_db.base_currency is None:
        return {}

    now: float = time.monotonic()
    next_fetch_at: float | None = exchange_rates_cache.next_fetch_at
    if next_fetch_at is None or now >= next_fetch_at:
        exchange_rates_cache.next_fetch_at = now + RETRY_SECONDS
        fetched_rates: dict[str, Decimal] | None = await _fetch_usd_rates()
        if fetched_rates is not None:
            exchange_rates_cache.usd_rates = fetched_rates
            exchange_rates_cache.next_fetch_at = now + exchange_rate_settings.cache_seconds

    base_usd_rate: Decimal | None = exchange_rates_cache.usd_rates.get(user_db.base_currency)
    if base_usd_rate is None:
        return {}

    base_currency_rates: dict[CurrencyCode, Decimal] = {}
    for currency, usd_rate in exchange_rates_cache.usd_rates.items():
        base_currency_rates[currency] = base_usd_rate / usd_rate

    return base_currency_rates


def get_estimate(
    *, amount: Decimal, currency: CurrencyCode, base_currency_rates: dict[CurrencyCode, Decimal]
) -> Decimal | None:
    base_currency_rate: Decimal | None = base_currency_rates.get(currency)
    if base_currency_rate is None:
        return None

    estimate: Decimal = utils.round_to_cents(amount=amount * base_currency_rate)
    return estimate
