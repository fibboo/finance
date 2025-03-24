from decimal import Decimal, ROUND_HALF_EVEN

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDTransferTransaction, transfer_transaction_crud
from app.crud.user.user import user_crud
from app.exceptions.forbidden_403 import NoAccountBaseCurrencyRate
from app.exceptions.unprocessable_422 import UnprocessableException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import TransferTransaction as TransferTransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.transaction import TransactionCreate, TransactionType, TransferRequest
from app.schemas.base import CurrencyType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(__name__)


class Transfer(TransactionProcessor[TransferRequest]):
    _base_currency: CurrencyType = CurrencyType.USD

    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.TRANSFER

    @property
    def _transaction_crud(self) -> type[CRUDTransferTransaction]:
        return transfer_transaction_crud

    async def _validate_transaction_from_account(self, from_account_db: AccountModel | None) -> None:
        await super()._validate_transaction_from_account(from_account_db=from_account_db)

    async def _validate_transaction_to_account(self, to_account_db: AccountModel | None) -> None:
        await super()._validate_transaction_to_account(to_account_db=to_account_db)

    async def _validate_transaction(self, to_account_db: AccountModel, from_account_db: AccountModel) -> None:
        await self._validate_transaction_from_account(from_account_db=from_account_db)
        await self._validate_transaction_to_account(to_account_db=to_account_db)

        user_db: UserModel = await user_crud.get(db=self.db, id=self.user_id)
        self._base_currency: CurrencyType = user_db.base_currency
        if self.data.destination_currency != self._base_currency and self.data.destination_amount is None:
            raise UnprocessableException(log_message='If destination_currency differs from user base currency, '
                                                     'destination_amount must be specified',
                                         logger=logger)

        if self.data.source_currency != self._base_currency and self.data.destination_currency != self._base_currency:
            if to_account_db.base_currency_rate == 0:
                raise NoAccountBaseCurrencyRate(account_id=to_account_db.id, logger=logger)

    async def _prepare_transaction(self) -> TransactionCreate:
        from_account_db: AccountModel | None = await account_crud.get_or_none(db=self.db,
                                                                              id=self.data.from_account_id,
                                                                              user_id=self.user_id)
        to_account_db: AccountModel | None = await account_crud.get(db=self.db,
                                                                    id=self.data.to_account_id,
                                                                    user_id=self.user_id)
        await self._validate_transaction(to_account_db=to_account_db, from_account_db=from_account_db)

        # from base currency account -> to base currency account
        if self.data.source_currency == self._base_currency and self.data.destination_currency == self._base_currency:
            self.data.destination_amount = self.data.source_amount
            base_currency_amount: Decimal = self.data.destination_amount

        # from base currency account -> to other currency account
        elif self.data.source_currency == self._base_currency and self.data.destination_currency != self._base_currency:
            base_currency_amount: Decimal = self.data.source_amount

        # from other currency account -> to base currency account
        elif self.data.source_currency != self._base_currency and self.data.destination_currency == self._base_currency:
            destination_amount: Decimal = self.data.source_amount / from_account_db.base_currency_rate
            self.data.destination_amount = destination_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
            base_currency_amount: Decimal = self.data.destination_amount

        # from other currency account -> to other currency account
        else:
            base_currency_amount: Decimal = self.data.source_amount / from_account_db.base_currency_rate
            base_currency_amount: Decimal = base_currency_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)

        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=base_currency_amount,
                                                                transaction_type=TransactionType.TRANSFER)
        return transaction_data

    async def _update_accounts(self, transaction_db: TransferTransactionModel):
        new_from_balance: Decimal = transaction_db.from_account.balance - transaction_db.source_amount
        new_from_balance: Decimal = new_from_balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        await account_crud.update(db=self.db, id=transaction_db.from_account_id, obj_in={'balance': new_from_balance})

        to_account_db: AccountModel = transaction_db.to_account
        new_to_balance: Decimal = to_account_db.balance + transaction_db.destination_amount
        if to_account_db.currency == self._base_currency:
            new_to_base_rate: Decimal = Decimal('1')

        elif to_account_db.base_currency_rate == 0:
            new_to_base_rate: Decimal = transaction_db.destination_amount / transaction_db.source_amount

        else:
            current_to_base_balance: Decimal = to_account_db.balance / to_account_db.base_currency_rate
            new_to_base_balance: Decimal = current_to_base_balance + transaction_db.base_currency_amount
            new_to_base_rate: Decimal = new_to_balance / new_to_base_balance

        new_to_balance: Decimal = new_to_balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        new_to_base_rate: Decimal = new_to_base_rate.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN)
        await account_crud.update(db=self.db,
                                  id=transaction_db.to_account_id,
                                  obj_in={'balance': new_to_balance, 'base_currency_rate': new_to_base_rate})
