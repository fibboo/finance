import logging

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType


class UnprocessableException(AppBaseException):
    def __init__(self, *,
                 log_message: str,
                 logger: logging.Logger,
                 log_level: LogLevelType = LogLevelType.WARNING,
                 message: str = 'Unprocessable entity',
                 error_code: ErrorCodeType | None = None):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                         message=message,
                         log_message=log_message,
                         logger=logger,
                         log_level=log_level,
                         error_code=error_code)
