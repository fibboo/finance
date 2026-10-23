from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.exceptions.not_implemented_501 import NotImplementedException
from app.exceptions.unprocessable_422 import MovementNotAllowed
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.transaction import TransactionType
from app.services.accounting.transaction_processor.adjustment import Adjustment
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
        TransactionType.ADJUSTMENT: Adjustment,
    }
)

MOVEMENT_TYPES: frozendict[tuple[AccountKind, AccountKind], TransactionType] = frozendict(
    {
        (AccountKind.ASSET, AccountKind.EXPENSE): TransactionType.EXPENSE,
        (AccountKind.LIABILITY, AccountKind.EXPENSE): TransactionType.EXPENSE,
        (AccountKind.INCOME, AccountKind.ASSET): TransactionType.INCOME,
        (AccountKind.INCOME, AccountKind.LIABILITY): TransactionType.INCOME,
        (AccountKind.ASSET, AccountKind.ASSET): TransactionType.TRANSFER,
        (AccountKind.ASSET, AccountKind.LIABILITY): TransactionType.TRANSFER,
        (AccountKind.LIABILITY, AccountKind.ASSET): TransactionType.TRANSFER,
        (AccountKind.LIABILITY, AccountKind.LIABILITY): TransactionType.TRANSFER,
    }
)


def get_processor(*, db: AsyncSession, user_id: UUID, transaction_type: TransactionType) -> TransactionProcessor:
    transaction_class: type[TransactionProcessor] | None = TRANSACTION_PROCESSORS.get(transaction_type)
    if transaction_class is None:
        raise NotImplementedException(log_message=f"Transaction {transaction_type} is not implemented", logger=logger)

    transaction_processor: TransactionProcessor = transaction_class(db=db, user_id=user_id)
    return transaction_processor


def get_movement_processor(
    *, db: AsyncSession, user_id: UUID, from_kind: AccountKind, to_kind: AccountKind
) -> TransactionProcessor:
    transaction_type: TransactionType | None = MOVEMENT_TYPES.get((from_kind, to_kind))
    if transaction_type is None:
        raise MovementNotAllowed(from_kind=from_kind, to_kind=to_kind, logger=logger)

    transaction_processor: TransactionProcessor = TRANSACTION_PROCESSORS[transaction_type](db=db, user_id=user_id)
    return transaction_processor
