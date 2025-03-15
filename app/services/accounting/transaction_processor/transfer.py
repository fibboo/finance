from app.schemas.accounting.transaction import TransactionCreate, TransactionType, TransferRequest
from app.services.accounting.transaction_processor.base import TransactionProcessor


class Transfer(TransactionProcessor[TransferRequest]):
    def _prepare_transaction(self) -> TransactionCreate:
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                transaction_type=TransactionType.TRANSFER)
        return transaction_data
