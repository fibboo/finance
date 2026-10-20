from pydantic import BaseModel

from app.schemas.user.external_user import ProviderType


class ProviderIdentity(BaseModel):
    provider: ProviderType
    external_id: str
    username: str | None
    first_name: str | None
    last_name: str | None
    avatar: str | None
    email: str | None
