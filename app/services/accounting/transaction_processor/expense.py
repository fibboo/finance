from app.schemas.accounting.transaction import ExpenseRequest, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor


class Expense(TransactionProcessor[ExpenseRequest]):
    def _prepare_transaction(self) -> TransactionCreate:
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                transaction_amount=self.data.original_amount,
                                                                transaction_currency=self.data.original_currency,
                                                                transaction_type=TransactionType.INCOME)
        return transaction_data
