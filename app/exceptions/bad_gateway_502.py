import logging

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType


class ProviderUnavailable(AppBaseException):
    def __init__(self, *, provider: ProviderType, reason: str, logger: logging.Logger):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            message="Sign-in provider is unavailable",
            log_message=f"{provider.value} discovery failed: {reason}",
            logger=logger,
            log_level=LogLevelType.ERROR,
            error_code=ErrorCodeType.PROVIDER_UNAVAILABLE,
        )
