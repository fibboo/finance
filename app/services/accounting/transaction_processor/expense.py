from decimal import Decimal

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDExpenseTransaction, expense_transaction_crud
from app.exceptions.forbidden_403 import AccountTypeMismatchException
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.transaction import ExpenseRequest, Transaction, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(__name__)


class Expense(TransactionProcessor[ExpenseRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.EXPENSE

    @property
    def _transaction_crud(self) -> CRUDExpenseTransaction:
        return expense_transaction_crud

    async def _validate_transaction_from_account(self, data: ExpenseRequest,
                                                 from_account_db: AccountModel | None) -> None:
        await super()._validate_transaction_from_account(data=data, from_account_db=from_account_db)

        if from_account_db.account_type != AccountType.CHECKING:
            raise AccountTypeMismatchException(account_id=from_account_db.id,
                                               transaction_type=self._transaction_type,
                                               account_type=from_account_db.account_type,
                                               logger=logger)

    async def _validate_transaction_to_account(self, data: ExpenseRequest, to_account_db: AccountModel | None) -> None:
        pass

    async def _prepare_transaction(self, data: ExpenseRequest) -> TransactionCreate:
        from_account: AccountModel | None = await account_crud.get_or_none(db=self.db,
                                                                           id=data.from_account_id,
                                                                           user_id=self.user_id)
        await self._validate_transaction_from_account(data=data, from_account_db=from_account)

        base_currency_amount: Decimal = data.source_amount / from_account.base_currency_rate
        transaction_data: TransactionCreate = TransactionCreate(**data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=base_currency_amount)
        return transaction_data

    async def _update_to_account(self, transaction_db: Transaction, is_delete: bool = False) -> None:
        pass
