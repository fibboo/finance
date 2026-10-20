from fastapi import Response

from app.configs.settings import settings
from app.schemas.user.token import TokenPair, TokenResponse

REFRESH_TOKEN_COOKIE = "refresh_token"
REFRESH_TOKEN_COOKIE_PATH = "/user/auth"


def build_token_response(*, response: Response, token_pair: TokenPair) -> TokenResponse:
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=token_pair.refresh_token,
        max_age=settings.refresh_token_expire_seconds,
        path=REFRESH_TOKEN_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )
    token_response = TokenResponse(
        access_token=token_pair.access_token, token_type="Bearer", expires_in=token_pair.expires_in
    )
    return token_response


def delete_refresh_token_cookie(*, response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE, path=REFRESH_TOKEN_COOKIE_PATH, secure=True, httponly=True, samesite="strict"
    )
