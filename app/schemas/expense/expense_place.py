from typing import Optional

from pydantic import BaseModel, constr

from app.schemas.base import EntityStatusType


class ExpensePlaceBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: Optional[constr(min_length=3, max_length=256)]

    class Config:
        orm_mode = True


class ExpensePlaceCreate(ExpensePlaceBase):
    status: EntityStatusType = EntityStatusType.ACTIVE


class ExpensePlaceUpdate(BaseModel):
    name: Optional[constr(min_length=3, max_length=64)]
    description: Optional[constr(min_length=3, max_length=256)]


class ExpensePlace(ExpensePlaceBase):
    id: int
    status: EntityStatusType


class ExpensePlaceRequest(BaseModel):
    name: Optional[constr(min_length=1, max_length=64)]
    description: Optional[constr(min_length=1, max_length=256)]
    statuses: list[EntityStatusType] = []
