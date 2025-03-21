from app.configs.logging_settings import get_logger
from app.crud.accounting.transaction import CRUDTransferTransaction, transfer_transaction_crud
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.accounting.transaction import TransferTransaction as TransferTransactionModel
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

    async def _prepare_transaction(self) -> TransactionCreate:
        raise NotImplementedException(log_message='Transfer transaction prepare is not implemented', logger=logger)
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                transaction_type=TransactionType.TRANSFER)
        return transaction_data

    async def _update_accounts(self, transaction_db: TransferTransactionModel):
        raise NotImplementedException(log_message='Transfer transaction update accounts is not implemented',
                                      logger=logger)
