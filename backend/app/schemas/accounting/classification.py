from enum import StrEnum
from typing import Annotated, TypeAlias
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints


class ClassificationKind(StrEnum):
    MONEY_ACCOUNT = "MONEY_ACCOUNT"
    EXPENSE_CATEGORY = "EXPENSE_CATEGORY"


ClassificationName: TypeAlias = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=32)]


class ClassificationNameRequest(BaseModel):
    name: ClassificationName


class Classification(ClassificationNameRequest):
    id: UUID
    kind: ClassificationKind
    is_default: bool

    model_config = ConfigDict(from_attributes=True)
