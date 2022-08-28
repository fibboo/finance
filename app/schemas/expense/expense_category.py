from typing import Optional
from uuid import UUID

from pydantic import BaseModel, constr, validator

from app.schemas.base import EnumUpperBase, EntityStatusType


class ExpenseType(EnumUpperBase):
    GENERAL = 'GENERAL'
    TARGET = 'TARGET'


class ExpenseCategoryBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: Optional[constr(min_length=3, max_length=256)]
    type: ExpenseType

    class Config:
        orm_mode = True


class ExpenseCategoryCreate(ExpenseCategoryBase):
    status: EntityStatusType = EntityStatusType.ACTIVE


class ExpenseCategoryUpdate(ExpenseCategoryBase):
    id: UUID


class ExpenseCategoryUpdateStatus(BaseModel):
    id: UUID
    status: EntityStatusType


class ExpenseCategory(ExpenseCategoryBase):
    id: UUID
    user_id: UUID
    status: EntityStatusType


class ExpenseCategorySearch(BaseModel):
    search_term: str = ''
    types: list[ExpenseType] = []
    statuses: list[EntityStatusType] = []

    @validator('search_term')
    def to_lower(cls, value):
        return value.lower()
