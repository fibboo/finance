from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi_pagination import Params
from pydantic import constr, ConfigDict, Field

from app.schemas.base import EnumUpperBase, EntityStatusType, BaseServiceModel


class CategoryType(EnumUpperBase):
    GENERAL = 'GENERAL'
    TARGET = 'TARGET'


class CategoryBase(BaseServiceModel):
    name: constr(min_length=3, max_length=64)
    description: Optional[constr(min_length=3, max_length=256)] = None
    type: CategoryType


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    pass


class Category(CategoryBase):
    id: UUID
    user_id: UUID
    status: EntityStatusType
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategorySearch(Params):
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(20, ge=1, le=100, description="Page size")

    search_term: Optional[str] = None
    types: list[CategoryType] = []
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]
