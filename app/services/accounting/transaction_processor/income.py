from decimal import Decimal, ROUND_HALF_EVEN

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDIncomeTransaction, income_transaction_crud
from app.exceptions.forbidden_403 import AccountTypeMismatchException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import IncomeTransaction as IncomeTransactionModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.transaction import IncomeRequest, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(__name__)


class Income(TransactionProcessor[IncomeRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.INCOME

    @property
    def _transaction_crud(self) -> type[CRUDIncomeTransaction]:
        return income_transaction_crud

    async def _validate_transaction_from_account(self, from_account_db: AccountModel | None) -> None:
        pass

    async def _validate_transaction_to_account(self, to_account_db: AccountModel | None) -> None:
        await super()._validate_transaction_to_account(to_account_db=to_account_db)

        if to_account_db.account_type != AccountType.INCOME:
            raise AccountTypeMismatchException(account_id=to_account_db.id,
                                               transaction_type=self._transaction_type,
                                               account_type=to_account_db.account_type,
                                               logger=logger)

    async def _prepare_transaction(self) -> TransactionCreate:
        to_account_db: AccountModel | None = await account_crud.get_or_none(db=self.db,
                                                                            id=self.data.to_account_id,
                                                                            user_id=self.user_id)
        await self._validate_transaction_to_account(to_account_db=to_account_db)

        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=self.data.source_amount,
                                                                transaction_type=TransactionType.INCOME)
        return transaction_data

    async def _update_accounts(self, transaction_db: IncomeTransactionModel):
        to_account_db: AccountModel = transaction_db.to_account
        new_balance: Decimal = to_account_db.balance + transaction_db.destination_amount
        if to_account_db.base_currency_rate == 0:
            new_base_rate: Decimal = transaction_db.destination_amount / transaction_db.source_amount
        else:
            current_base_balance: Decimal = to_account_db.balance / to_account_db.base_currency_rate
            new_base_balance: Decimal = current_base_balance + transaction_db.base_currency_amount
            new_base_rate: Decimal = new_balance / new_base_balance

        new_balance: Decimal = new_balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        new_base_rate: Decimal = new_base_rate.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN)
        await account_crud.update(db=self.db,
                                  id=transaction_db.to_account_id,
                                  obj_in={'balance': new_balance, 'base_currency_rate': new_base_rate})
