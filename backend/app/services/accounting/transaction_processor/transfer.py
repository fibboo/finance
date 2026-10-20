from decimal import Decimal
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDTransferTransaction, transfer_transaction_crud
from app.exceptions.forbidden_403 import NoAccountBaseCurrencyRate
from app.exceptions.unprocessable_422 import UnprocessableException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import TransferTransaction as TransferTransactionModel
from app.schemas.accounting.transaction import TransactionCreate, TransactionType, TransferRequest
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


class Transfer(TransactionProcessor[TransferRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.TRANSFER

    @property
    def _transaction_crud(self) -> type[CRUDTransferTransaction]:
        return transfer_transaction_crud

    @staticmethod
    def _get_transaction_accounts(*, transaction_db: TransferTransactionModel) -> list[AccountModel]:
        accounts_db: list[AccountModel] = [transaction_db.from_account, transaction_db.to_account]
        return accounts_db

    async def __validate_transaction(
        self, *, data: TransferRequest, to_account_db: AccountModel, from_account_db: AccountModel
    ) -> None:
        await self._validate_transaction_from_account(data=data, from_account_db=from_account_db)
        await self._validate_transaction_to_account(data=data, to_account_db=to_account_db)

        if data.destination_currency != self.base_currency and data.destination_amount is None:
            raise UnprocessableException(
                log_message="If destination_currency differs from user base currency, "
                "destination_amount must be specified",
                logger=logger,
            )

        if data.source_currency != self.base_currency and data.destination_currency != self.base_currency:
            if to_account_db.base_currency_rate == 0:
                raise NoAccountBaseCurrencyRate(account_id=to_account_db.id, logger=logger)

    async def _prepare_transaction(self, *, data: TransferRequest) -> TransactionCreate:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.from_account_id, data.to_account_id], user_id=self.user_id
        )
        from_account_db: AccountModel | None = accounts_db.get(data.from_account_id)
        to_account_db: AccountModel | None = accounts_db.get(data.to_account_id)
        await self.__validate_transaction(data=data, to_account_db=to_account_db, from_account_db=from_account_db)

        is_source_base_currency: bool = data.source_currency == self.base_currency
        is_destination_base_currency: bool = data.destination_currency == self.base_currency
        if is_source_base_currency and is_destination_base_currency:
            data.destination_amount = data.source_amount
            base_currency_amount: Decimal = data.destination_amount

        elif is_source_base_currency and not is_destination_base_currency:
            base_currency_amount: Decimal = data.source_amount

        elif not is_source_base_currency and is_destination_base_currency:
            data.destination_amount = self._quantize_amount(
                amount=data.source_amount / from_account_db.base_currency_rate
            )
            base_currency_amount: Decimal = data.destination_amount

        else:
            base_currency_amount: Decimal = self._quantize_amount(
                amount=data.source_amount / from_account_db.base_currency_rate
            )

        transaction_data: TransactionCreate = TransactionCreate(
            **data.model_dump(), user_id=self.user_id, base_currency_amount=base_currency_amount
        )
        return transaction_data
