from fastapi import Response

from app.configs.settings import settings

REFRESH_TOKEN_COOKIE = "refresh_token"
REFRESH_TOKEN_COOKIE_PATH = "/user/auth"


def set_refresh_token_cookie(*, response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        max_age=settings.refresh_token_expire_seconds,
        path=REFRESH_TOKEN_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )


def delete_refresh_token_cookie(*, response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE, path=REFRESH_TOKEN_COOKIE_PATH, secure=True, httponly=True, samesite="strict"
    )
