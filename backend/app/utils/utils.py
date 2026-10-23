import hashlib
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any

from pydantic import BaseModel


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
