from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.base import CurrencyCode


class Currency(BaseModel):
    code: CurrencyCode
    name: Annotated[str, StringConstraints(min_length=1, max_length=64)]

    model_config = ConfigDict(from_attributes=True)
