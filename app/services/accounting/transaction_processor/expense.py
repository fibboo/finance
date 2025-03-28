from decimal import Decimal

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDExpenseTransaction, expense_transaction_crud
from app.exceptions.forbidden_403 import AccountTypeMismatchException
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

    async def _validate_transaction_from_account(self, from_account_db: AccountModel | None) -> None:
        await super()._validate_transaction_from_account(from_account_db=from_account_db)

        if from_account_db.account_type != AccountType.CHECKING:
            raise AccountTypeMismatchException(account_id=from_account_db.id,
                                               transaction_type=self._transaction_type,
                                               account_type=from_account_db.account_type,
                                               logger=logger)

    async def _validate_transaction_to_account(self, to_account_db: AccountModel | None) -> None:
        pass

    async def _prepare_transaction(self) -> TransactionCreate:
        from_account: AccountModel | None = await account_crud.get_or_none(db=self.db,
                                                                           id=self.data.from_account_id,
                                                                           user_id=self.user_id)
        await self._validate_transaction_from_account(from_account_db=from_account)

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
