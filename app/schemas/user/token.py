from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, model_validator


class TokenPair(BaseModel):
    access_token: str
    expires_in: int
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int


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

    @model_validator(mode="after")
    def check_grant_fields(self) -> Self:
        code_fields: dict[str, str | None] = {
            "code": self.code,
            "redirect_uri": self.redirect_uri,
            "code_verifier": self.code_verifier,
        }
        missing: list[str] = [name for name, value in code_fields.items() if value is None]
        if self.grant_type == "authorization_code" and len(missing) > 0:
            raise ValueError(f"authorization_code grant requires {', '.join(missing)}")

        return self
