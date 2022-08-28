from uuid import UUID

from fastapi import Header

from app.schemas.user.user import UserSession, User


async def verify_user(x_auth_token: UUID = Header(...)) -> UserSession:
    user_session = UserSession(token=x_auth_token, user=User(id=x_auth_token))
    return user_session
