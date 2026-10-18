from pydantic import BaseModel

from app.schemas.user.external_user import ProviderType


class AuthData(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: str | None = None
    scope: str
    user_identifier: str | None = None

    provider: ProviderType
    external_id: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    avatar: str | None = None
    profile_url: str | None = None
    email: str | None = None
