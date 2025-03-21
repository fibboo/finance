from uuid import UUID

from fastapi_pagination import Params
from pydantic import BaseModel, ConfigDict, constr, Field

from app.utils import utils


class IncomeSourceBase(BaseModel):
    name: constr(min_length=3, max_length=64)
    description: constr(min_length=3, max_length=256) | None = None


class IncomeSourceCreateRequest(IncomeSourceBase):
    pass


class IncomeSourceCreate(IncomeSourceBase):
    user_id: UUID


class IncomeSourceUpdate(IncomeSourceBase):
    pass


class IncomeSource(IncomeSourceCreate):
    id: UUID  # noqa: A003

    model_config = ConfigDict(from_attributes=True)


class IncomeSourceRequest(Params):
    page: int = Field(1, ge=1, description='Page number')
    size: int = Field(20, ge=1, le=100, description='Page size')

    search_term: str | None = None

    def __hash__(self):
        data = self.model_dump()
        hashable_items: tuple = utils.make_hashable(data)
        return hash(hashable_items)
