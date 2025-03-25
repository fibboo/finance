import logging

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType


class NotImplementedException(AppBaseException):
    def __init__(self, log_message: str, logger: logging.Logger):
        super().__init__(status_code=status.HTTP_501_NOT_IMPLEMENTED,
                         title='Not implemented',
                         message='Not implemented',
                         log_message=log_message,
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.NOT_IMPLEMENTED)
