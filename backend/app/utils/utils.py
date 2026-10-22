import hashlib
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any

from pydantic import BaseModel

from app.schemas.base import CurrencyCode


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


def get_base_currency_balance(*, balance: Decimal, base_currency_rate: Decimal) -> Decimal:
    if base_currency_rate == 0:
        base_currency_balance: Decimal = Decimal("0.00")
    else:
        base_currency_balance: Decimal = round_to_cents(amount=balance / base_currency_rate)

    return base_currency_balance


def get_fixed_base_currency_rate(
    *, currency: CurrencyCode | None, base_currency: CurrencyCode | None
) -> Decimal | None:
    fixed_rate: Decimal | None = Decimal("1") if currency == base_currency else None
    return fixed_rate


def get_new_account_base_currency_rate(*, currency: CurrencyCode | None, base_currency: CurrencyCode) -> Decimal:
    fixed_rate: Decimal | None = get_fixed_base_currency_rate(currency=currency, base_currency=base_currency)
    base_currency_rate: Decimal = fixed_rate if fixed_rate is not None else Decimal("0")
    return base_currency_rate
