from datetime import datetime
from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, constr, ConfigDict, Field

from app.schemas.base import EntityStatusType


class LocationBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: constr(min_length=3, max_length=256) | None = None
    coordinates: constr(min_length=3, max_length=64) | None = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(LocationBase):
    pass


class Location(LocationBase):
    id: UUID  # noqa: A003
    user_id: UUID
    status: EntityStatusType
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LocationRequest(Params):
    page: int = Field(1, ge=1, description='Page number')
    size: int = Field(20, ge=1, le=100, description='Page size')

    search_term: str | None = None
    statuses: list[EntityStatusType] = [EntityStatusType.ACTIVE]

    def __hash__(self):
        return hash((self.page,
                     self.size,
                     self.search_term,
                     ''.join(map(str, self.statuses))))
