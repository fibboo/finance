from uuid import UUID

from pydantic import BaseModel


class User(BaseModel):
    id: UUID


class UserSession(BaseModel):
    token: UUID
    user: User
