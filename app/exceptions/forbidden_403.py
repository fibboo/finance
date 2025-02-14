import logging

from app.configs.logging_settings import LogLevelType
from app.configs.settings import EnvironmentType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType, ErrorStatusType


class ForbiddenException(AppBaseException):
    def __init__(self,
                 title: str,
                 log_message: str,
                 logger: logging.Logger,
                 log_level: LogLevelType,
                 error_code: ErrorCodeType | None = None):
        super().__init__(status_code=ErrorStatusType.HTTP_403_FORBIDDEN,
                         title=title,
                         log_message=log_message,
                         logger=logger,
                         log_level=log_level,
                         error_code=error_code)


class EnvironmentMismatch(ForbiddenException):
    def __init__(self, required_env: EnvironmentType, logger: logging.Logger):
        super().__init__(title='Environment mismatch',
                         log_message=f'For this action {required_env} environment required',
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.ENVIRONMENT_MISMATCH)
