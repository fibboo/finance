import logging
from decimal import Decimal
from uuid import UUID

from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.base import AppBaseException
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import CurrencyCode
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


class AccountKindMismatch(UnprocessableException):
    def __init__(self, *, account_id: UUID, kinds: list[AccountKind], logger: logging.Logger):
        expected_kinds: str = ", ".join(kind.value for kind in kinds)
        super().__init__(
            message="Account kind mismatch",
            log_message=f"Account `{account_id}` is not an active account of kind {expected_kinds}",
            logger=logger,
            error_code=ErrorCodeType.ACCOUNT_KIND_MISMATCH,
        )


class MovementNotAllowed(UnprocessableException):
    def __init__(self, *, from_kind: AccountKind, to_kind: AccountKind, logger: logging.Logger):
        super().__init__(
            message="Movement not allowed",
            log_message=f"Money can not move from a {from_kind.value} account to a {to_kind.value} account",
            logger=logger,
            error_code=ErrorCodeType.MOVEMENT_NOT_ALLOWED,
        )


class TransactionTypeChangeNotAllowed(UnprocessableException):
    def __init__(
        self,
        *,
        transaction_id: UUID,
        transaction_type: TransactionType,
        new_transaction_type: TransactionType,
        logger: logging.Logger,
    ):
        super().__init__(
            message="Transaction type change not allowed",
            log_message=(
                f"The {transaction_type.value} transaction `{transaction_id}` can not become "
                f"a {new_transaction_type.value} transaction"
            ),
            logger=logger,
            error_code=ErrorCodeType.TRANSACTION_TYPE_CHANGE_NOT_ALLOWED,
        )


class FieldRequired(UnprocessableException):
    def __init__(self, *, transaction_type: TransactionType, field: str, logger: logging.Logger):
        super().__init__(
            message=f"Field {field} required",
            log_message=f"Transaction type {transaction_type.value} needs {field}",
            logger=logger,
            error_code=ErrorCodeType.FIELD_REQUIRED,
        )


class FieldNotAllowed(UnprocessableException):
    def __init__(self, *, transaction_type: TransactionType, field: str, logger: logging.Logger):
        super().__init__(
            message=f"Field {field} not allowed",
            log_message=f"Transaction type {transaction_type.value} does not take {field}",
            logger=logger,
            error_code=ErrorCodeType.FIELD_NOT_ALLOWED,
        )


class BaseCurrencyAmountNotAllowed(UnprocessableException):
    def __init__(self, *, account_id: UUID, base_currency_amount: Decimal, logger: logging.Logger):
        super().__init__(
            message="Base currency amount not allowed",
            log_message=(
                f"A base_currency_amount of {base_currency_amount} was sent for account `{account_id}`, "
                f"whose base currency amount is derived"
            ),
            logger=logger,
            error_code=ErrorCodeType.BASE_CURRENCY_AMOUNT_NOT_ALLOWED,
        )


class BaseCurrencyAmountRequired(UnprocessableException):
    def __init__(self, *, currency: CurrencyCode, logger: logging.Logger):
        super().__init__(
            message="Base currency amount required",
            log_message=f"An income in `{currency}` needs a base_currency_amount: it is not the base currency",
            logger=logger,
            error_code=ErrorCodeType.BASE_CURRENCY_AMOUNT_REQUIRED,
        )


class TransferAmountMismatch(UnprocessableException):
    def __init__(self, *, destination_amount: Decimal, derived_destination_amount: Decimal, logger: logging.Logger):
        super().__init__(
            message="Transfer amount mismatch",
            log_message=(
                f"A transfer sent destination_amount {destination_amount}, "
                f"while its currencies give {derived_destination_amount}"
            ),
            logger=logger,
            error_code=ErrorCodeType.TRANSFER_AMOUNT_MISMATCH,
        )


class DestinationAmountNotAllowed(UnprocessableException):
    def __init__(self, *, account_id: UUID, destination_amount: Decimal, logger: logging.Logger):
        super().__init__(
            message="Destination amount not allowed",
            log_message=(
                f"A destination_amount of {destination_amount} was sent for account `{account_id}`, "
                f"whose amount is derived from the source account's rate"
            ),
            logger=logger,
            error_code=ErrorCodeType.DESTINATION_AMOUNT_NOT_ALLOWED,
        )
