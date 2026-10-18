from enum import Enum
from typing import Annotated, TypeAlias

from pydantic import StringConstraints


class EntityStatusType(str, Enum):
    ACTIVE = "ACTIVE"
    DELETED = "DELETED"


CurrencyCode: TypeAlias = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
