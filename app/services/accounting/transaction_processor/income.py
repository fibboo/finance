from decimal import Decimal, ROUND_HALF_EVEN

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDIncomeTransaction, income_transaction_crud
from app.exceptions.forbidden_403 import AccountTypeMismatchException, CurrencyMismatchException
from app.exceptions.not_fount_404 import EntityNotFound
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

    async def _validate_transaction(self,
                                    to_account_db: AccountModel,
                                    from_account_db: AccountModel | None = None) -> None:
        if to_account_db is None:
            raise EntityNotFound(entity=AccountModel, search_params={'id': self.data.to_account_id}, logger=logger)

        if to_account_db.currency != self.data.destination_currency:
            raise CurrencyMismatchException(account_id=to_account_db.id,
                                            transaction_currency=self.data.source_currency,
                                            account_currency=to_account_db.currency,
                                            logger=logger)

        if to_account_db.account_type != AccountType.INCOME:
            raise AccountTypeMismatchException(account_id=to_account_db.id,
                                               transaction_type=self._transaction_type,
                                               account_type=to_account_db.account_type,
                                               logger=logger)

    async def _prepare_transaction(self) -> TransactionCreate:
        to_account_db: AccountModel = await account_crud.get(db=self.db,
                                                             id=self.data.to_account_id,
                                                             user_id=self.user_id)
        await self._validate_transaction(to_account_db=to_account_db)

        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=self.data.source_amount,
                                                                transaction_type=TransactionType.INCOME)
        return transaction_data

    async def _update_accounts(self, transaction_db: IncomeTransactionModel):
        to_account: AccountModel = transaction_db.to_account
        new_balance: Decimal = to_account.balance + transaction_db.destination_amount
        if to_account.base_currency_rate == 0:
            new_base_rate: Decimal = transaction_db.destination_amount / transaction_db.source_amount
        else:
            current_base_balance: Decimal = to_account.balance / to_account.base_currency_rate
            new_base_balance: Decimal = current_base_balance + transaction_db.base_currency_amount
            new_base_rate: Decimal = new_balance / new_base_balance

        new_balance = new_balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        new_base_rate = new_base_rate.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN)
        await account_crud.update(db=self.db,
                                  id=transaction_db.to_account_id,
                                  obj_in={'balance': new_balance, 'base_currency_rate': new_base_rate})
