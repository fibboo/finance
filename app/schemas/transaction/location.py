from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, constr, Field


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
    page: int = Field(1, ge=1, description='Page number')
    size: int = Field(20, ge=1, le=100, description='Page size')

    search_term: str | None = None

    def __hash__(self):
        return hash((self.page,
                     self.size,
                     self.search_term,
                     ''.join(map(str, self.statuses))))
