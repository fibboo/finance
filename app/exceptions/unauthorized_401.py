import logging
from uuid import UUID

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType


class UnauthorizedException(AppBaseException):
    def __init__(
        self,
        *,
        message: str,
        log_message: str,
        logger: logging.Logger,
        log_level: LogLevelType,
        error_code: ErrorCodeType | None = None,
    ):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message=message,
            log_message=log_message,
            logger=logger,
            log_level=log_level,
            error_code=error_code,
        )


class InvalidTokenException(UnauthorizedException):
    def __init__(self, *, log_message: str, logger: logging.Logger):
        super().__init__(
            message="Invalid token",
            log_message=log_message,
            logger=logger,
            log_level=LogLevelType.DEBUG,
            error_code=ErrorCodeType.INVALID_TOKEN,
        )


class RefreshTokenRejectedException(UnauthorizedException):
    pass


class RefreshTokenReusedException(RefreshTokenRejectedException):
    def __init__(self, *, family_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Invalid token",
            log_message=f"Revoked refresh token of family `{family_id}` reused, family revoked",
            logger=logger,
            log_level=LogLevelType.WARNING,
            error_code=ErrorCodeType.INVALID_TOKEN,
        )


class TokenExpiredException(UnauthorizedException):
    def __init__(self, *, log_message: str, logger: logging.Logger):
        super().__init__(
            message="Token expired",
            log_message=log_message,
            logger=logger,
            log_level=LogLevelType.DEBUG,
            error_code=ErrorCodeType.TOKEN_EXPIRED,
        )


class InvalidRefreshTokenException(RefreshTokenRejectedException, InvalidTokenException):
    pass


class RefreshTokenExpiredException(RefreshTokenRejectedException, TokenExpiredException):
    pass


class InvalidAuthData(UnauthorizedException):
    def __init__(self, *, log_message: str, logger: logging.Logger):
        super().__init__(
            message="Invalid auth data",
            log_message=log_message,
            logger=logger,
            log_level=LogLevelType.WARNING,
            error_code=ErrorCodeType.INVALID_AUTH_DATA,
        )
