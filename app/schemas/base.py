from enum import Enum
from typing import Annotated, TypeAlias

from pydantic import StringConstraints


class EntityStatusType(str, Enum):
    ACTIVE = "ACTIVE"
    DELETED = "DELETED"


CurrencyCode: TypeAlias = Annotated[str, StringConstraints(min_length=3, max_length=3)]
