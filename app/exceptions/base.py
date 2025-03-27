import logging

from app.configs.logging_settings import LogLevelType
from app.schemas.error_response import ErrorCodeType


class AppBaseException(Exception):
    def __init__(self,
                 status_code: int,
                 message: str,
                 log_message: str,
                 logger: logging.Logger,
                 log_level: LogLevelType = LogLevelType.ERROR,
                 error_code: ErrorCodeType | None = None):
        self.status_code: int = status_code
        self.message: str = message
        self.log_message: str = log_message
        self.logger: logging.Logger = logger
        self.log_level: LogLevelType = log_level
        self.error_code: ErrorCodeType | None = error_code
