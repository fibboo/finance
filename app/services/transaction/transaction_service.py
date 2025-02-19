from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.transaction.transaction import transaction_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.transaction.transaction import Transaction as TransactionModel
from app.schemas.base import EntityStatusType
from app.schemas.transaction.transaction import (IncomeRequest, SpendRequest, Transaction, TransactionCreate,
                                                 TransactionRequest, TransactionType, TransactionUpdate,
                                                 TransferRequest)
from app.utils.decorators import update_balances

logger = get_logger(__name__)


async def _create_transaction(db: AsyncSession, transaction_data: TransactionCreate) -> Transaction:
    try:
        transaction_db: TransactionModel = await transaction_crud.create(db=db, obj_in=transaction_data)

    except IntegrityError as exc:
        raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

    transaction: Transaction = Transaction.model_validate(transaction_db)
    return transaction


@update_balances
async def income(db: AsyncSession, income_data: IncomeRequest, user_id: UUID) -> Transaction:
    transaction_data: TransactionCreate = TransactionCreate(**income_data.model_dump(),
                                                            user_id=user_id,
                                                            transaction_amount=income_data.original_amount,
                                                            transaction_currency=income_data.original_currency,
                                                            transaction_type=TransactionType.INCOME)
    transaction: Transaction = await _create_transaction(db=db, transaction_data=transaction_data)
    return transaction


@update_balances
async def spend(db: AsyncSession, spend_data: SpendRequest, user_id: UUID) -> Transaction:
    transaction_data: TransactionCreate = TransactionCreate(**spend_data.model_dump(),
                                                            user_id=user_id,
                                                            transaction_type=TransactionType.EXPENSE)
    transaction: Transaction = await _create_transaction(db=db, transaction_data=transaction_data)

    return transaction


@update_balances
async def transfer(db: AsyncSession, transfer_data: TransferRequest, user_id: UUID) -> Transaction:
    transaction_data: TransactionCreate = TransactionCreate(**transfer_data.model_dump(),
                                                            user_id=user_id,
                                                            transaction_type=TransactionType.TRANSFER)
    transaction: Transaction = await _create_transaction(db=db, transaction_data=transaction_data)
    return transaction


async def get_transactions(db: AsyncSession, request: TransactionRequest, user_id: UUID) -> Page[Transaction]:
    expenses_db: Page[TransactionModel] = await transaction_crud.get_transactions(db=db,
                                                                                  request=request,
                                                                                  user_id=user_id)
    expenses = Page[Transaction].model_validate(expenses_db)
    return expenses


async def get_transaction_by_id(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> Transaction:
    expense_db: TransactionModel | None = await transaction_crud.get_or_none(db=db, id=transaction_id, user_id=user_id)

    if expense_db is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    expense: Transaction = Transaction.model_validate(expense_db)
    return expense


async def update_transaction(db: AsyncSession,
                             transaction_id: UUID,
                             update_data: TransactionUpdate,
                             user_id: UUID) -> Transaction:
    try:
        expense_db: TransactionModel | None = await transaction_crud.update(db=db,
                                                                            id=transaction_id,
                                                                            obj_in=update_data,
                                                                            user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

    if expense_db is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    expense: Transaction = Transaction.model_validate(expense_db)
    return expense


async def delete_expense(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> None:
    delete_update_data = {'status': EntityStatusType.DELETED}

    try:
        expense_db: TransactionModel | None = await transaction_crud.update(db=db,
                                                                            id=transaction_id,
                                                                            obj_in=delete_update_data,
                                                                            user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

    if expense_db is None:
        raise EntityNotFound(entity=TransactionModel,
                             search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)
