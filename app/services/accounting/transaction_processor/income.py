from app.schemas.accounting.transaction import IncomeRequest, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor


class Income(TransactionProcessor[IncomeRequest]):
    def _prepare_transaction(self) -> TransactionCreate:
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                transaction_type=TransactionType.EXPENSE)
        return transaction_data
