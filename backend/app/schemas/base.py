from decimal import Decimal
from enum import Enum
from typing import Annotated, TypeAlias

from pydantic import Field, StringConstraints


class EntityStatusType(str, Enum):
    ACTIVE = "ACTIVE"
    DELETED = "DELETED"


CurrencyCode: TypeAlias = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
RequestAmount: TypeAlias = Annotated[Decimal, Field(gt=Decimal("0"), max_digits=15, decimal_places=2)]
TransactionComment: TypeAlias = Annotated[str, StringConstraints(min_length=3, max_length=256)]
