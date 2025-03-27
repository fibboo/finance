import logging
from typing import Any

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.models.base import Base
from app.schemas.error_response import ErrorCodeType


class NotFoundException(AppBaseException):
    def __init__(self,
                 message: str,
                 log_message: str,
                 logger: logging.Logger,
                 log_level: LogLevelType,
                 error_code: ErrorCodeType | None = None):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND,
                         message=message,
                         log_message=log_message,
                         logger=logger,
                         log_level=log_level,
                         error_code=error_code)


class EntityNotFound(NotFoundException):
    def __init__(self,
                 entity: type[Base],
                 search_params: dict[str, Any],
                 logger: logging.Logger,
                 log_level: LogLevelType = LogLevelType.ERROR):
        super().__init__(message='Entity not found',
                         log_message=f'{entity.__name__} not found by {search_params}',
                         error_code=ErrorCodeType.ENTITY_NOT_FOUND,
                         logger=logger,
                         log_level=log_level)
