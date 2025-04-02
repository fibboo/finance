from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.transaction import Transaction, TransactionRequest

logger = get_logger(__name__)


async def get_transactions(db: AsyncSession, request: TransactionRequest, user_id: UUID) -> Page[Transaction]:
    transactions_db: Page[TransactionModel] = await transaction_crud.get_transactions(db=db,
                                                                                      request=request,
                                                                                      user_id=user_id)
    transactions = Page[Transaction].model_validate(transactions_db)
    return transactions


async def get_transaction(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> Transaction:
    transaction_db: TransactionModel | None = await transaction_crud.get_or_none(db=db,
                                                                                 id=transaction_id,
                                                                                 user_id=user_id)

    if transaction_db is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    transaction: Transaction = Transaction.model_validate(transaction_db)
    return transaction
