class EntityException(Exception):
    def __init__(self, message: str):
        self.message = message


class NotFoundEntity(EntityException):
    pass


class UnauthorizedException(EntityException):
    pass


class ProcessingException(EntityException):
    pass
