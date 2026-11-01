import hashlib
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any

from pydantic import BaseModel

RECENT_USE_DAYS: int = 90


def make_hashable(*, value: Any) -> tuple:
    if isinstance(value, dict):
        hashable: tuple = tuple(sorted((k, make_hashable(value=v)) for k, v in value.items()))
        return hashable

    elif isinstance(value, (list, tuple)):
        hashable: tuple = tuple(make_hashable(value=v) for v in value)
        return hashable

    elif isinstance(value, set):
        hashable: tuple = tuple(sorted(make_hashable(value=v) for v in value))
        return hashable

    elif isinstance(value, BaseModel):
        hashable: tuple = make_hashable(value=value.model_dump())
        return hashable

    else:
        return value


def hash_secret(*, secret: str) -> str:
    secret_hash: str = hashlib.sha256(secret.encode("utf-8")).hexdigest()
    return secret_hash


def round_to_cents(*, amount: Decimal) -> Decimal:
    rounded_amount: Decimal = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
    return rounded_amount


def get_base_currency_rate(*, balance: Decimal, base_balance: Decimal) -> Decimal:
    if balance == 0 or base_balance == 0:
        base_currency_rate: Decimal = Decimal("0")
    else:
        base_currency_rate: Decimal = (balance / base_balance).quantize(
            Decimal("0.0000000001"), rounding=ROUND_HALF_EVEN
        )

    return base_currency_rate


def get_recent_use_dates(*, today: date) -> tuple[date, date]:
    recent_use_dates: tuple[date, date] = (today - timedelta(days=RECENT_USE_DAYS - 1), today + timedelta(days=1))
    return recent_use_dates
