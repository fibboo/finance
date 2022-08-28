from typing import Optional
from uuid import UUID

from pydantic import BaseModel, constr, validator

from app.schemas.base import EntityStatusType


class ExpensePlaceBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: Optional[constr(min_length=3, max_length=256)]

    class Config:
        orm_mode = True


class ExpensePlaceCreate(ExpensePlaceBase):
    status: EntityStatusType = EntityStatusType.ACTIVE


class ExpensePlaceUpdate(ExpensePlaceBase):
    id: UUID


class ExpensePlaceUpdateStatus(BaseModel):
    id: UUID
    status: EntityStatusType


class ExpensePlace(ExpensePlaceBase):
    id: UUID
    user_id: UUID
    status: EntityStatusType


class ExpensePlaceSearch(BaseModel):
    search_term: str = ''
    statuses: list[EntityStatusType] = []

    @validator('search_term')
    def to_lower(cls, value):
        return value.lower()
