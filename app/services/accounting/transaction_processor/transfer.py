from decimal import Decimal, ROUND_HALF_EVEN

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDTransferTransaction, transfer_transaction_crud
from app.exceptions.forbidden_403 import NoAccountBaseCurrencyRate
from app.exceptions.unprocessable_422 import UnprocessableException
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.transaction import TransactionCreate, TransactionType, TransferRequest
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(__name__)


class Transfer(TransactionProcessor[TransferRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.TRANSFER

    @property
    def _transaction_crud(self) -> type[CRUDTransferTransaction]:
        return transfer_transaction_crud

    async def _validate_transaction(self,
                                    data: TransferRequest,
                                    to_account_db: AccountModel,
                                    from_account_db: AccountModel) -> None:
        await self._validate_transaction_from_account(data=data, from_account_db=from_account_db)
        await self._validate_transaction_to_account(data=data, to_account_db=to_account_db)

        if data.destination_currency != self.base_currency and data.destination_amount is None:
            raise UnprocessableException(log_message='If destination_currency differs from user base currency, '
                                                     'destination_amount must be specified',
                                         logger=logger)

        if data.source_currency != self.base_currency and data.destination_currency != self.base_currency:
            if to_account_db.base_currency_rate == 0:
                raise NoAccountBaseCurrencyRate(account_id=to_account_db.id, logger=logger)

    async def _prepare_transaction(self, data: TransferRequest) -> TransactionCreate:
        from_account_db: AccountModel | None = await account_crud.get_or_none(db=self.db,
                                                                              id=data.from_account_id,
                                                                              user_id=self.user_id)
        to_account_db: AccountModel | None = await account_crud.get(db=self.db,
                                                                    id=data.to_account_id,
                                                                    user_id=self.user_id)
        await self._validate_transaction(data=data, to_account_db=to_account_db, from_account_db=from_account_db)

        # from base currency account -> to base currency account
        if data.source_currency == self.base_currency and data.destination_currency == self.base_currency:
            data.destination_amount = data.source_amount
            base_currency_amount: Decimal = data.destination_amount

        # from base currency account -> to other currency account
        elif data.source_currency == self.base_currency and data.destination_currency != self.base_currency:
            base_currency_amount: Decimal = data.source_amount

        # from other currency account -> to base currency account
        elif data.source_currency != self.base_currency and data.destination_currency == self.base_currency:
            destination_amount: Decimal = data.source_amount / from_account_db.base_currency_rate
            data.destination_amount = destination_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
            base_currency_amount: Decimal = data.destination_amount

        # from other currency account -> to other currency account
        else:
            base_currency_amount: Decimal = data.source_amount / from_account_db.base_currency_rate
            base_currency_amount: Decimal = base_currency_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)

        transaction_data: TransactionCreate = TransactionCreate(**data.model_dump(),
                                                                user_id=self.user_id,
                                                                base_currency_amount=base_currency_amount)
        return transaction_data
