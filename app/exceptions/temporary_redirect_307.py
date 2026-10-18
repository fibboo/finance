from starlette import status

from app.exceptions.base import AppBaseException


class ClientRedirect(AppBaseException):
    def __init__(self, *, url: str, exception: AppBaseException):
        super().__init__(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            message="Redirect to the client",
            log_message=exception.log_message,
            logger=exception.logger,
            log_level=exception.log_level,
        )
        self.url: str = url
