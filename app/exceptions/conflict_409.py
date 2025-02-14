import logging

from sqlalchemy.exc import IntegrityError

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.models import Base
from app.schemas.error_response import ErrorCodeType, ErrorStatusType


class ConflictException(AppBaseException):
    def __init__(self,
                 title: str,
                 log_message: str,
                 error_code: ErrorCodeType,
                 logger: logging.Logger,
                 log_level: LogLevelType):
        super().__init__(status_code=ErrorStatusType.HTTP_409_CONFLICT,
                         title=title,
                         log_message=log_message,
                         logger=logger,
                         log_level=log_level,
                         error_code=error_code)


class IntegrityException(ConflictException):
    def __init__(self, entity: type[Base], exception: IntegrityError, logger: logging.Logger):
        error_detail = exception.orig.args[0].split('\n')[1]
        super().__init__(title='Entity integrity error',
                         log_message=f'{entity.__name__} integrity error: {error_detail}',
                         error_code=ErrorCodeType.INTEGRITY_ERROR,
                         logger=logger,
                         log_level=LogLevelType.ERROR)
