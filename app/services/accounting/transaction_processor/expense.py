from decimal import Decimal

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDExpenseTransaction, expense_transaction_crud
from app.exceptions.forbidden_403 import (AccountTypeMismatchException, CurrencyMismatchException,
                                          NoAccountBaseCurrencyRate)
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import ExpenseTransaction as ExpenseTransactionModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.transaction import ExpenseRequest, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(__name__)


class Expense(TransactionProcessor[ExpenseRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.EXPENSE

    @property
    def _transaction_crud(self) -> CRUDExpenseTransaction:
        return expense_transaction_crud

    async def _prepare_transaction(self) -> TransactionCreate:
        from_account: AccountModel | None = await account_crud.get(db=self.db,
                                                                   id=self.data.from_account_id,
                                                                   user_id=self.user_id)
        if from_account is None:
            raise EntityNotFound(entity=AccountModel, search_params={'id': self.data.from_account_id}, logger=logger)

        if from_account.base_currency_rate == 0:
            raise NoAccountBaseCurrencyRate(account_id=from_account.id, logger=logger)

        if from_account.currency != self.data.source_currency:
            raise CurrencyMismatchException(account_id=from_account.id,
                                            transaction_currency=self.data.source_currency,
                                            account_currency=from_account.currency,
                                            logger=logger)

        if from_account.account_type != AccountType.CHECKING:
            raise AccountTypeMismatchException(account_id=from_account.id,
                                               transaction_type=self._transaction_type,
                                               account_type=from_account.account_type,
                                               logger=logger)

        base_currency_amount: Decimal = self.data.source_amount / from_account.base_currency_rate
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=base_currency_amount,
                                                                transaction_type=self._transaction_type)
        return transaction_data

    async def _update_accounts(self, transaction_db: ExpenseTransactionModel) -> None:
        balance: Decimal = transaction_db.from_account.balance - transaction_db.source_amount
        await account_crud.update(db=self.db,
                                  id=transaction_db.from_account_id,
                                  obj_in={'balance': balance})
