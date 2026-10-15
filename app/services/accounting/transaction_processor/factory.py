from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.exceptions.not_implemented_501 import NotImplementedException
from app.schemas.accounting.transaction import TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor
from app.services.accounting.transaction_processor.expense import Expense
from app.services.accounting.transaction_processor.income import Income
from app.services.accounting.transaction_processor.transfer import Transfer

logger = get_logger(logger_name=__name__)

TRANSACTION_PROCESSORS: frozendict[TransactionType, type[TransactionProcessor]] = frozendict(
    {
        TransactionType.EXPENSE: Expense,
        TransactionType.INCOME: Income,
        TransactionType.TRANSFER: Transfer,
    }
)


def get_processor(*, db: AsyncSession, user_id: UUID, transaction_type: TransactionType) -> TransactionProcessor:
    transaction_class: type[TransactionProcessor] | None = TRANSACTION_PROCESSORS.get(transaction_type)
    if transaction_class is None:
        raise NotImplementedException(log_message=f"Transaction {transaction_type} is not implemented", logger=logger)

    transaction_processor: TransactionProcessor = transaction_class(db=db, user_id=user_id)
    return transaction_processor
