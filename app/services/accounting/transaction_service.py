from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.transaction import Transaction, TransactionCreateRequest, TransactionUpdate
from app.schemas.base import EntityStatusType
from app.utils.decorators import update_balances

logger = get_logger(__name__)


async def get_transactions(db: AsyncSession, request: TransactionCreateRequest, user_id: UUID) -> Page[Transaction]:
    transactions_db: Page[TransactionModel] = await transaction_crud.get_transactions(db=db,
                                                                                      request=request,
                                                                                      user_id=user_id)
    transactions = Page[Transaction].model_validate(transactions_db)
    return transactions


async def get_transaction_by_id(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> Transaction:
    transaction_db: TransactionModel | None = await transaction_crud.get_or_none(db=db,
                                                                                 id=transaction_id,
                                                                                 user_id=user_id)

    if transaction_db is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    transaction: Transaction = Transaction.model_validate(transaction_db)
    return transaction


async def _update_balances(db: AsyncSession,
                           transaction_before: TransactionModel,
                           transaction_after: TransactionModel) -> None:
    if transaction_before.from_account_id != transaction_after.from_account_id:
        if transaction_before.from_account is not None:
            old_balance: Decimal = transaction_before.from_account.balance + transaction_before.transaction_amount
            await account_crud.update(db=db,
                                      id=transaction_before.from_account_id,
                                      obj_in={'balance': old_balance})

        if transaction_after.from_account is not None:
            new_balance: Decimal = transaction_after.from_account.balance - transaction_after.transaction_amount
            await account_crud.update(db=db,
                                      id=transaction_after.from_account_id,
                                      obj_in={'balance': new_balance})

    if transaction_before.to_account_id != transaction_after.to_account_id:
        if transaction_before.to_account is not None:
            old_balance: Decimal = transaction_before.to_account.balance - transaction_before.transaction_amount
            await account_crud.update(db=db,
                                      id=transaction_before.to_account_id,
                                      obj_in={'balance': old_balance})
        if transaction_after.to_account is not None:
            new_balance: Decimal = transaction_after.to_account.balance + transaction_after.transaction_amount
            await account_crud.update(db=db,
                                      id=transaction_after.to_account_id,
                                      obj_in={'balance': new_balance})

    amount_diff: Decimal = transaction_after.transaction_amount - transaction_before.transaction_amount
    if transaction_before.from_account_id == transaction_after.from_account_id and amount_diff != 0:
        if transaction_after.from_account is not None:
            await account_crud.update(db=db,
                                      id=transaction_after.from_account_id,
                                      obj_in={'balance': transaction_after.from_account.balance + amount_diff})

    if transaction_before.to_account_id == transaction_after.to_account_id and amount_diff != 0:
        if transaction_after.to_account is not None:
            await account_crud.update(db=db,
                                      id=transaction_after.to_account_id,
                                      obj_in={'balance': transaction_after.to_account.balance - amount_diff})


async def update_transaction(db: AsyncSession,
                             transaction_id: UUID,
                             update_data: TransactionUpdate,
                             user_id: UUID) -> Transaction:
    transaction_before: TransactionModel | None = await transaction_crud.get_or_none(db=db,
                                                                                     id=transaction_id,
                                                                                     user_id=user_id,
                                                                                     status=EntityStatusType.ACTIVE)
    if transaction_before is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    transaction_db: TransactionModel = await transaction_crud.update(db=db,
                                                                     obj_in=update_data,
                                                                     user_id=user_id,
                                                                     id=transaction_id,
                                                                     status=EntityStatusType.ACTIVE)

    await _update_balances(db=db, transaction_before=transaction_before, transaction_after=transaction_db)

    expense: Transaction = Transaction.model_validate(transaction_db)
    return expense


@update_balances
async def delete_transaction(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> Transaction:
    delete_update_data = {'status': EntityStatusType.DELETED}
    transaction_db: TransactionModel | None = await transaction_crud.update(db=db,
                                                                            obj_in=delete_update_data,
                                                                            id=transaction_id,
                                                                            user_id=user_id,
                                                                            status=EntityStatusType.ACTIVE)
    if transaction_db is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    expense: Transaction = Transaction.model_validate(transaction_db)
    return expense
