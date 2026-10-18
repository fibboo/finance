import logging
from decimal import Decimal
from uuid import UUID

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import ErrorCodeType


class UnprocessableException(AppBaseException):
    def __init__(
        self,
        *,
        log_message: str,
        logger: logging.Logger,
        log_level: LogLevelType = LogLevelType.WARNING,
        message: str = "Unprocessable entity",
        error_code: ErrorCodeType | None = None,
    ):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            message=message,
            log_message=log_message,
            logger=logger,
            log_level=log_level,
            error_code=error_code,
        )


class RedirectUriNotAllowed(UnprocessableException):
    def __init__(self, *, redirect_uri: str, logger: logging.Logger):
        super().__init__(
            message="Redirect URI not allowed",
            log_message=f"Redirect URI `{redirect_uri}` is not in the allowed redirect URIs",
            logger=logger,
            error_code=ErrorCodeType.REDIRECT_URI_NOT_ALLOWED,
        )


class AccountBalanceUnchanged(UnprocessableException):
    def __init__(self, *, account_id: UUID, balance: Decimal, logger: logging.Logger):
        super().__init__(
            message="Account balance unchanged",
            log_message=f"Account `{account_id}` already has the balance {balance}",
            logger=logger,
            error_code=ErrorCodeType.ACCOUNT_BALANCE_UNCHANGED,
        )


class BaseCurrencyAmountNotAllowed(UnprocessableException):
    def __init__(self, *, account_id: UUID, logger: logging.Logger):
        super().__init__(
            message="Base currency amount not allowed",
            log_message=f"Account `{account_id}` has a base currency rate, so it takes no base_currency_amount",
            logger=logger,
            error_code=ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED,
        )
