from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: str


class RefreshTokenCreate(BaseModel):
    user_id: UUID
    token_hash: str
    family_id: UUID
    expires_at: datetime


class TokenRequest(BaseModel):
    grant_type: Literal["authorization_code", "refresh_token"]
    code: str | None = None
    redirect_uri: str | None = None
    code_verifier: str | None = None
    refresh_token: str | None = None

    @model_validator(mode="after")
    def check_grant_fields(self) -> "TokenRequest":
        if self.grant_type == "authorization_code":
            required: dict[str, str | None] = {
                "code": self.code,
                "redirect_uri": self.redirect_uri,
                "code_verifier": self.code_verifier,
            }
        else:
            required: dict[str, str | None] = {"refresh_token": self.refresh_token}

        missing: list[str] = [name for name, value in required.items() if value is None]
        if len(missing) > 0:
            raise ValueError(f"{self.grant_type} grant requires {', '.join(missing)}")

        return self
