import logging
from uuid import UUID

from app.configs.logging_settings import LogLevelType
from app.configs.settings import EnvironmentType, settings
from app.exceptions.base import AppBaseException
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType, ErrorStatusType


class ForbiddenException(AppBaseException):
    def __init__(self,
                 title: str,
                 log_message: str,
                 logger: logging.Logger,
                 log_level: LogLevelType,
                 error_code: ErrorCodeType | None = None):
        super().__init__(status_code=ErrorStatusType.HTTP_403_FORBIDDEN,
                         title=title,
                         log_message=log_message,
                         logger=logger,
                         log_level=log_level,
                         error_code=error_code)


class EnvironmentMismatch(ForbiddenException):
    def __init__(self, required_env: EnvironmentType, logger: logging.Logger):
        super().__init__(title='Environment mismatch',
                         log_message=f'For this action {required_env} environment required',
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.ENVIRONMENT_MISMATCH)


class MaxAccountsReached(ForbiddenException):
    def __init__(self, user_id: UUID, logger: logging.Logger):
        super().__init__(title='Max accounts per user',
                         log_message=f'Max number of accounts ({settings.max_accounts_per_user}) '
                                     f'reached for user_id `{user_id}`',
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.MAX_ACCOUNTS_PER_USER)


class AccountDeletionForbidden(ForbiddenException):
    def __init__(self, account_id: UUID, logger: logging.Logger):
        super().__init__(title='Account deletion forbidden',
                         log_message=f'Account `{account_id}` can not be deleted. Account balance is not 0',
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.ACCOUNT_DELETION_FORBIDDEN)


class NoAccountBaseCurrencyRate(ForbiddenException):
    def __init__(self, account_id: UUID, logger: logging.Logger):
        super().__init__(title='Account has no base currency rate',
                         log_message=f'Account `{account_id}` has no base currency rate. Try to make first deposit',
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE)


class CurrencyMismatch(ForbiddenException):
    def __init__(self,
                 currency: CurrencyType,
                 account_id: UUID,
                 account_currency: CurrencyType,
                 logger: logging.Logger):
        super().__init__(title='Account and transaction currency mismatch',
                         log_message=(f'Transaction currency {currency} differs '
                                      f'from account `{account_id}` currency {account_currency}'),
                         logger=logger,
                         log_level=LogLevelType.ERROR,
                         error_code=ErrorCodeType.CURRENCY_MISMATCH)
