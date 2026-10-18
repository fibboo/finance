import hashlib
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
