from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import Query
from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.utils import utils


class CategoryBase(BaseModel):
    name: Annotated[str, StringConstraints(min_length=3, max_length=64)]
    description: Annotated[str, StringConstraints(min_length=3, max_length=256)] | None = None


class CategoryCreateRequest(CategoryBase):
    pass


class CategoryCreate(CategoryCreateRequest):
    user_id: UUID


class CategoryUpdate(CategoryBase):
    pass


class Category(CategoryBase):
    id: UUID  # noqa: A003
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryRequest(Params):
    page: int = Query(1, ge=1, description="Page number")
    size: int = Query(20, ge=1, le=100, description="Page size")

    search_term: Annotated[str, StringConstraints(min_length=3)] | None = None

    def __hash__(self):
        data = self.model_dump()
        hashable_items: tuple = utils.make_hashable(value=data)
        return hash(hashable_items)
