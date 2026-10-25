import logging
from uuid import UUID

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.base import CurrencyCode
from app.schemas.error_response import ErrorCodeType


class ForbiddenException(AppBaseException):
    def __init__(
        self,
        *,
        message: str,
        log_message: str,
        logger: logging.Logger,
        log_level: LogLevelType,
        error_code: ErrorCodeType | None = None,
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            message=message,
            log_message=log_message,
            logger=logger,
            log_level=log_level,
            error_code=error_code,
        )


class AccountDeletionForbidden(ForbiddenException):
    def __init__(self, *, account_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Account deletion forbidden",
            log_message=f"Account `{account_id}` can not be deleted. Account balance is not 0",
            logger=logger,
            log_level=LogLevelType.ERROR,
            error_code=ErrorCodeType.ACCOUNT_DELETION_FORBIDDEN,
        )


class LastAccountDeletionForbidden(ForbiddenException):
    def __init__(self, *, account_id: UUID, logger: logging.Logger):
        super().__init__(
            message="The last money account cannot be deleted",
            log_message=f"Account `{account_id}` is the last active money account of its user",
            logger=logger,
            log_level=LogLevelType.INFO,
            error_code=ErrorCodeType.LAST_ACCOUNT_DELETION_FORBIDDEN,
        )


class DeletedAccountTransactionForbidden(ForbiddenException):
    def __init__(self, *, account_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Transactions of a deleted account are forbidden",
            log_message=f"Account `{account_id}` is deleted. Restore it to create or delete its transactions",
            logger=logger,
            log_level=LogLevelType.ERROR,
            error_code=ErrorCodeType.DELETED_ACCOUNT_TRANSACTION_FORBIDDEN,
        )


class NoAccountBaseCurrencyRate(ForbiddenException):
    def __init__(self, *, account_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Accounts has no base currency rate",
            log_message=f"Account {account_id} has no base currency rate. Try to make first deposit",
            logger=logger,
            log_level=LogLevelType.ERROR,
            error_code=ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE,
        )


class CurrencyMismatchException(ForbiddenException):
    def __init__(
        self,
        *,
        account_id: UUID,
        transaction_currency: CurrencyCode,
        account_currency: CurrencyCode,
        logger: logging.Logger,
    ):
        super().__init__(
            message="Account and transaction currency mismatch",
            log_message=(
                f"Transaction currency {transaction_currency} differs "
                f"from account `{account_id}` currency {account_currency}"
            ),
            logger=logger,
            log_level=LogLevelType.ERROR,
            error_code=ErrorCodeType.CURRENCY_MISMATCH,
        )


class OriginNotAllowed(ForbiddenException):
    def __init__(self, *, origin: str, logger: logging.Logger):
        super().__init__(
            message="Origin not allowed",
            log_message=f"Origin `{origin}` is not in the allowed origins",
            logger=logger,
            log_level=LogLevelType.WARNING,
            error_code=ErrorCodeType.ORIGIN_NOT_ALLOWED,
        )
