from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.transaction import (ExpenseRequest, IncomeRequest, Transaction, TransactionCreate,
                                                TransactionCreateRequest, TransferRequest)
from app.utils.decorators import update_balances

T = TypeVar('T', bound=TransactionCreateRequest)

logger = get_logger(__name__)


class TransactionProcessor(ABC, Generic[T]):
    def __init__(self, db: AsyncSession, user_id: UUID, data: T):
        self.db: AsyncSession = db
        self.data: T = data
        self.user_id: UUID = user_id

    @classmethod
    def factory(cls, db: AsyncSession, user_id: UUID, data: TransactionCreateRequest) -> 'TransactionProcessor':
        from app.services.accounting.transaction_processor.income import Income
        from app.services.accounting.transaction_processor.expense import Expense
        from app.services.accounting.transaction_processor.transfer import Transfer

        data_processor = {IncomeRequest: Income, ExpenseRequest: Expense, TransferRequest: Transfer}
        transaction_class: type[TransactionProcessor] | None = data_processor.get(type(data), None)
        if transaction_class is None:
            raise NotImplementedException(log_message=f'Transaction {type(data).__name__} is not implemented',
                                          logger=logger)

        transaction_processor: TransactionProcessor = transaction_class(db=db, user_id=user_id, data=data)
        return transaction_processor

    @abstractmethod
    def _prepare_transaction(self) -> TransactionCreate:
        pass

    def _validate_accounts_currency(self, transaction_db: TransactionModel):
        raise NotImplementedException(log_message='Transaction currency validation is not implemented', logger=logger)

    @update_balances
    async def create(self) -> Transaction:
        transaction_data: TransactionCreate = self._prepare_transaction()
        try:
            transaction_db: TransactionModel = await transaction_crud.create(db=self.db, obj_in=transaction_data)

        except IntegrityError as exc:
            raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

        self._validate_accounts_currency(transaction_db=transaction_db)

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction
