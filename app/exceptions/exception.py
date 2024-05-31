from sqlalchemy.exc import IntegrityError

from app.models.base import Base


class EntityException(Exception):
    def __init__(self, message: str):
        self.message = message


class NotFoundException(EntityException):
    pass


class NotFoundIntegrity(NotFoundException):
    def __init__(self, model: type[Base], exception: IntegrityError):
        error_detail = exception.orig.args[0].split('\n')[1]
        message = f'{model.__name__} not found: {error_detail}'
        super().__init__(message=message)


class UnauthorizedException(EntityException):
    pass


class ProcessingException(EntityException):
    pass


class IntegrityExistException(ProcessingException):
    def __init__(self, model: type[Base], exception: IntegrityError):
        error_detail = exception.orig.args[0].split('\n')[1]
        message = f'{model.__name__} integrity exception: {error_detail}'
        super().__init__(message=message)
