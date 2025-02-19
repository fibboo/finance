from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_db_transaction, get_user_id
from app.schemas.transaction.transaction import (IncomeRequest, SpendRequest, Transaction, TransactionRequest,
                                                 TransactionUpdate, TransferRequest)
from app.services.transaction import transaction_service

router = APIRouter()


@router.post('/income')
async def income(income_data: IncomeRequest,
                 user_id: UUID = Depends(get_user_id),
                 db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    transaction: Transaction = await transaction_service.income(db=db, income_data=income_data, user_id=user_id)
    return transaction


@router.post('/spend')
async def spend(spend_data: SpendRequest,
                user_id: UUID = Depends(get_user_id),
                db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    transaction: Transaction = await transaction_service.spend(db=db, spend_data=spend_data, user_id=user_id)
    return transaction


@router.post('/transfer')
async def transfer(transfer_data: TransferRequest,
                   user_id: UUID = Depends(get_user_id),
                   db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    transaction: Transaction = await transaction_service.transfer(db=db, transfer_data=transfer_data, user_id=user_id)
    return transaction


@router.get('')
async def get_transactions(request: TransactionRequest,
                           user_id: UUID = Depends(get_user_id),
                           db: AsyncSession = Depends(get_db)) -> Page[Transaction]:
    transactions: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                 request=request,
                                                                                 user_id=user_id)
    return transactions


@router.get('/{transaction_id}')
async def get_transaction_by_id(transaction_id: UUID,
                                user_id: UUID = Depends(get_user_id),
                                db: AsyncSession = Depends(get_db)) -> Transaction:
    transaction: Transaction = await transaction_service.get_transaction_by_id(db=db,
                                                                               transaction_id=transaction_id,
                                                                               user_id=user_id)
    return transaction


@router.put('/{transaction_id}')
async def update_transaction(transaction_id: UUID,
                             update_data: TransactionUpdate,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    transaction: Transaction = await transaction_service.update_transaction(db=db,
                                                                            transaction_id=transaction_id,
                                                                            update_data=update_data,
                                                                            user_id=user_id)
    return transaction


@router.delete('/{transaction_id}', status_code=200)
async def delete_transaction(transaction_id: UUID,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> None:
    await transaction_service.delete_expense(db=db, transaction_id=transaction_id, user_id=user_id)
