import logging
from uuid import UUID

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType


class UnauthorizedException(AppBaseException):
    def __init__(self,
                 message: str,
                 log_message: str,
                 logger: logging.Logger,
                 log_level: LogLevelType,
                 error_code: ErrorCodeType | None = None):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED,
                         message=message,
                         log_message=log_message,
                         logger=logger,
                         log_level=log_level,
                         error_code=error_code)


class SessionExpiredException(UnauthorizedException):
    def __init__(self, token: UUID, logger: logging.Logger):
        super().__init__(message='Session expired',
                         log_message=f'Session with token `{token}` expired',
                         logger=logger,
                         log_level=LogLevelType.DEBUG,
                         error_code=ErrorCodeType.SESSION_EXPIRED)


class InvalidAuthData(UnauthorizedException):
    def __init__(self, log_message: str, logger: logging.Logger):
        super().__init__(message='Invalid auth data',
                         log_message=log_message,
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.INVALID_AUTH_DATA)
