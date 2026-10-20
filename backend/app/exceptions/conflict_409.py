import logging
from uuid import UUID

from asyncpg import PostgresError
from sqlalchemy.exc import IntegrityError
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.models.base import Base
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType


class ConflictException(AppBaseException):
    def __init__(
        self,
        *,
        message: str,
        log_message: str,
        error_code: ErrorCodeType,
        logger: logging.Logger,
        log_level: LogLevelType,
    ):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            log_message=log_message,
            logger=logger,
            log_level=log_level,
            error_code=error_code,
        )


class IntegrityException(ConflictException):
    def __init__(self, *, entity: type[Base], exception: IntegrityError, logger: logging.Logger):
        driver_error: PostgresError = exception.driver_exception
        if driver_error.constraint_name is not None:
            failed_object: str = driver_error.constraint_name
        else:
            failed_object: str = driver_error.column_name

        failed_on: str = f"{driver_error.table_name}.{failed_object}"
        super().__init__(
            message="Entity integrity error",
            log_message=f"{entity.__name__} integrity error: {driver_error.sqlstate} on {failed_on}",
            error_code=ErrorCodeType.INTEGRITY_ERROR,
            logger=logger,
            log_level=LogLevelType.ERROR,
        )


class BaseCurrencyNotSet(ConflictException):
    def __init__(self, *, user_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Base currency is not set",
            log_message=f"User `{user_id}` has not chosen a base currency yet",
            error_code=ErrorCodeType.BASE_CURRENCY_NOT_SET,
            logger=logger,
            log_level=LogLevelType.INFO,
        )


class BaseCurrencyAlreadySet(ConflictException):
    def __init__(self, *, user_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Base currency is already set",
            log_message=f"User `{user_id}` already has a base currency",
            error_code=ErrorCodeType.BASE_CURRENCY_ALREADY_SET,
            logger=logger,
            log_level=LogLevelType.ERROR,
        )


class ProviderAlreadyLinked(ConflictException):
    def __init__(self, *, user_id: UUID, provider: ProviderType, logger: logging.Logger):
        super().__init__(
            message="Provider is already linked",
            log_message=f"User `{user_id}` already has a {provider.value} identity",
            error_code=ErrorCodeType.PROVIDER_ALREADY_LINKED,
            logger=logger,
            log_level=LogLevelType.INFO,
        )


class LastIdentityUnlinkForbidden(ConflictException):
    def __init__(self, *, user_id: UUID, provider: ProviderType, logger: logging.Logger):
        super().__init__(
            message="The last sign-in provider cannot be unlinked",
            log_message=f"User `{user_id}` tried to unlink {provider.value}, the last identity",
            error_code=ErrorCodeType.LAST_IDENTITY_UNLINK_FORBIDDEN,
            logger=logger,
            log_level=LogLevelType.INFO,
        )


class IdentityLinkedToAnotherUser(ConflictException):
    def __init__(self, *, user_id: UUID, provider: ProviderType, logger: logging.Logger):
        super().__init__(
            message="The identity is linked to another user",
            log_message=f"The {provider.value} identity linked for user `{user_id}` belongs to another user",
            error_code=ErrorCodeType.IDENTITY_LINKED_TO_ANOTHER_USER,
            logger=logger,
            log_level=LogLevelType.WARNING,
        )
