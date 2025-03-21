from decimal import Decimal

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.exceptions.forbidden_403 import CurrencyMismatch, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import ExpenseTransaction as ExpenseTransactionModel
from app.schemas.accounting.transaction import ExpenseRequest, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(__name__)


class Expense(TransactionProcessor[ExpenseRequest]):
    async def _prepare_transaction(self) -> TransactionCreate:
        from_account: AccountModel | None = await account_crud.get(db=self.db,
                                                                   id=self.data.from_account_id,
                                                                   user_id=self.user_id)
        if from_account is None:
            raise EntityNotFound(entity=AccountModel, search_params={'id': self.data.from_account_id}, logger=logger)

        if from_account.base_currency_rate == 0:
            raise NoAccountBaseCurrencyRate(account_id=from_account.id, logger=logger)

        if self.data.source_currency != from_account.currency:
            raise CurrencyMismatch(currency=self.data.source_currency,
                                   account_id=from_account.id,
                                   account_currency=from_account.currency,
                                   logger=logger)

        base_currency_amount: Decimal = self.data.source_amount / from_account.base_currency_rate
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=base_currency_amount,
                                                                transaction_type=TransactionType.EXPENSE)
        return transaction_data

    async def _update_accounts(self, transaction_db: ExpenseTransactionModel) -> None:
        balance: Decimal = transaction_db.from_account.balance - transaction_db.source_amount
        await account_crud.update(db=self.db,
                                  id=transaction_db.from_account_id,
                                  obj_in={'balance': balance})
