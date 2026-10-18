from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class Currency(BaseModel):
    code: Annotated[str, StringConstraints(min_length=3, max_length=3)]
    name: Annotated[str, StringConstraints(min_length=1, max_length=64)]

    model_config = ConfigDict(from_attributes=True)
