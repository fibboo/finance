from uuid import UUID

from fastapi import Query
from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, constr

from app.utils import utils


class LocationBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: constr(min_length=3, max_length=256) | None = None
    coordinates: constr(min_length=3, max_length=64) | None = None


class LocationCreateRequest(LocationBase):
    pass


class LocationCreate(LocationBase):
    user_id: UUID


class LocationUpdate(LocationBase):
    pass


class Location(LocationCreate):
    id: UUID  # noqa: A003

    model_config = ConfigDict(from_attributes=True)


class LocationRequest(Params):
    page: int = Query(1, ge=1, description='Page number')
    size: int = Query(20, ge=1, le=100, description='Page size')

    search_term: constr(min_length=3) | None = None

    def __hash__(self):
        data = self.model_dump()
        hashable_items: tuple = utils.make_hashable(data)
        return hash(hashable_items)
