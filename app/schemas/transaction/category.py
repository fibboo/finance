from datetime import datetime
from enum import Enum
from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, constr, Field


class CategoryType(str, Enum):
    GENERAL = 'GENERAL'
    TARGET = 'TARGET'


class CategoryBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: constr(min_length=3, max_length=256) | None = None
    type: CategoryType  # noqa: A003


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    pass


class Category(CategoryBase):
    id: UUID  # noqa: A003
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryRequest(Params):
    page: int = Field(1, ge=1, description='Page number')
    size: int = Field(20, ge=1, le=100, description='Page size')

    search_term: str | None = None
    types: list[CategoryType] = []

    def __hash__(self):
        return hash((self.page,
                     self.size,
                     self.search_term,
                     ''.join(map(str, self.types)),
                     ''.join(map(str, self.statuses))))
