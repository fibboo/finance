import logging

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException


class ClientRedirect(AppBaseException):
    def __init__(self, *, url: str, log_message: str, logger: logging.Logger):
        super().__init__(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            message="Redirect to the client",
            log_message=log_message,
            logger=logger,
            log_level=LogLevelType.WARNING,
        )
        self.url: str = url
