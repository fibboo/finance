from app.configs.logging_settings import get_logger
from app.crud.accounting.transaction import CRUDIncomeTransaction, income_transaction_crud
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.accounting.transaction import IncomeTransaction as IncomeTransactionModel
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

    async def _prepare_transaction(self) -> TransactionCreate:
        raise NotImplementedException(log_message='Income transaction prepare is not implemented', logger=logger)
        transaction_data: TransactionCreate = TransactionCreate(**self.data.model_dump(),
                                                                user_id=self.user_id,
                                                                transaction_type=TransactionType.INCOME)
        return transaction_data

    async def _update_accounts(self, transaction_db: IncomeTransactionModel):
        raise NotImplementedException(log_message='Income transaction update accounts is not implemented',
                                      logger=logger)
