from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi_pagination import Params
from pydantic import constr, ConfigDict, Field

from app.schemas.base import EntityStatusType, BaseServiceModel


class LocationBase(BaseServiceModel):
    name: constr(min_length=3, max_length=64)
    description: Optional[constr(min_length=3, max_length=256)] = None
    coordinates: Optional[constr(min_length=3, max_length=64)] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(LocationBase):
    pass


class Location(LocationBase):
    id: UUID
    user_id: UUID
    status: EntityStatusType
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LocationRequest(Params):
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(20, ge=1, le=100, description="Page size")

    search_term: Optional[str] = None
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]
