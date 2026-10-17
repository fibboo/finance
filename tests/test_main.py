import logging

from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.exceptions.unauthorized_401 import InvalidRefreshTokenException
from app.main import refresh_token_rejected_handler


async def test_refresh_token_rejected_handler_clears_cookie():
    # Arrange
    exc = InvalidRefreshTokenException(log_message="Unknown refresh token", logger=logging.getLogger(__name__))

    # Act
    response: JSONResponse = await refresh_token_rejected_handler(Request(scope={"type": "http"}), exc)

    # Assert
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    set_cookie: str = response.headers["set-cookie"]
    assert set_cookie.startswith('refresh_token="";')
    assert "Max-Age=0" in set_cookie
    assert "Path=/user/auth" in set_cookie
