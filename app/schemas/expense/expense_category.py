from typing import Optional

from pydantic import BaseModel, constr

from app.schemas.base import EnumUpperBase, EntityStatusType


class ExpenseType(EnumUpperBase):
    GENERAL = 'GENERAL'
    TARGET = 'TARGET'


class ExpenseCategoryBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: Optional[constr(min_length=3, max_length=256)] = None
    type: ExpenseType

    class Config:
        orm_mode = True


class ExpenseCategoryCreate(ExpenseCategoryBase):
    status: EntityStatusType = EntityStatusType.ACTIVE


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[constr(min_length=3, max_length=64)]
    description: Optional[constr(min_length=3, max_length=256)]
    type: Optional[ExpenseType]


class ExpenseCategory(ExpenseCategoryBase):
    id: int
    status: EntityStatusType


class ExpenseCategoryRequest(BaseModel):
    name: Optional[constr(min_length=1, max_length=64)]
    description: Optional[constr(min_length=1, max_length=256)]
    types: list[ExpenseType] = []
    statuses: list[EntityStatusType] = []
