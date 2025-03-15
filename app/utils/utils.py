from typing import Any

from pydantic import BaseModel


def make_hashable(value: Any) -> tuple:
    if isinstance(value, dict):
        return tuple(sorted((k, make_hashable(v)) for k, v in value.items()))
    elif isinstance(value, (list, tuple)):
        return tuple(make_hashable(v) for v in value)
    elif isinstance(value, set):
        return tuple(sorted(make_hashable(v) for v in value))
    elif isinstance(value, BaseModel):
        return make_hashable(value.model_dump())
    else:
        return value
