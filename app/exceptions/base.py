import logging

from app.configs.logging_settings import LogLevelType
from app.schemas.error_response import ErrorCodeType


class AppBaseException(Exception):
    def __init__(self,
                 status_code: int,
                 title: str,
                 log_message: str,
                 logger: logging.Logger,
                 message: str | None = None,
                 log_level: LogLevelType = LogLevelType.ERROR,
                 error_code: ErrorCodeType | None = None):
        self.status_code: int = status_code
        self.title: str = title
        self.message: str = message if message is not None else log_message
        self.log_message: str = log_message
        self.logger: logging.Logger = logger
        self.log_level: LogLevelType = log_level
        self.error_code: ErrorCodeType | None = error_code
