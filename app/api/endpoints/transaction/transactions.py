from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_db_transaction, get_user_id
from app.schemas.transaction.transaction import Transaction, TransactionRequest, TransactionUpdate
from app.services.transaction import transaction_service

router = APIRouter()


@router.post('/spend')
async def spend(expense_create: ExpenseCreate,
                user_id: UUID = Depends(get_user_id),
                db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    expanse: Transaction = await transaction_service.spend(db=db, expense_create=expense_create, user_id=user_id)
    return expanse


@router.post('/transfer')
async def transfer(expense_create: TransferCreate,
                   user_id: UUID = Depends(get_user_id),
                   db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    expanse: Transaction = await transaction_service.transfer(db=db, expense_create=expense_create, user_id=user_id)
    return expanse


@router.get('')
async def get_transactions(body: TransactionRequest,
                           user_id: UUID = Depends(get_user_id),
                           db: AsyncSession = Depends(get_db)) -> Page[Transaction]:
    expanse: Page[Transaction] = await transaction_service.get_expenses(db=db, request=body, user_id=user_id)
    return expanse


@router.get('/{transaction_id}')
async def get_transaction_by_id(transaction_id: UUID,
                                user_id: UUID = Depends(get_user_id),
                                db: AsyncSession = Depends(get_db)) -> Transaction:
    expanse: Transaction = await transaction_service.get_expense_by_id(db=db, transaction_id=transaction_id, user_id=user_id)
    return expanse


@router.put('/{transaction_id}')
async def update_transaction(transaction_id: UUID,
                             transaction_update: TransactionUpdate,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    expanse: Transaction = await transaction_service.update_expense(db=db,
                                                                    transaction_id=transaction_id,
                                                                    transaction_update=transaction_update,
                                                                    user_id=user_id)
    return expanse


@router.delete('/{transaction_id}', status_code=200)
async def delete_transaction(transaction_id: UUID,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> None:
    await transaction_service.delete_expense(db=db, transaction_id=transaction_id, user_id=user_id)
