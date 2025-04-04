from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_db_transaction, get_user_id
from app.schemas.accounting.transaction import (Transaction, TransactionCreateRequest, TransactionRequest,
                                                TransactionType)
from app.services.accounting import transaction_service
from app.services.accounting.transaction_processor.base import TransactionProcessor

router = APIRouter()


@router.post('')
async def create_transaction(create_data: TransactionCreateRequest,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    """
    Creates a new transaction.

    **Transaction fields:**
    - `source_amount` — Amount in the withdrawal currency
    - `source_currency` — Withdrawal currency
    - `destination_amount` — Amount in the receiving currency
    - `destination_currency` — Receiving currency
    - `base_currency_amount` — Amount in the user's base currency

    **Context-specific behavior:**
    - **Expenses:** `source_*` refers to the amount **withdrawn from the account**.
    `destination_*` refers to the amount in **the seller's currency**.
    - **Income:** `source_*` refers to the incoming amount in **the base currency**.
    `destination_*` refers to the credited amount in **the receiving account**.
    - **Transfers:** `source_*` refers to **the withdrawal from one account**.
    `destination_*` refers to the deposit to **another account**.
    """
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=create_data.transaction_type)
    transaction: Transaction = await transaction_processor.create(data=create_data)
    return transaction


@router.get('')
async def get_transactions(request: TransactionRequest = Depends(),
                           user_id: UUID = Depends(get_user_id),
                           db: AsyncSession = Depends(get_db)) -> Page[Transaction]:
    transactions: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                 request=request,
                                                                                 user_id=user_id)
    return transactions


@router.get('/{transaction_id}')
async def get_transaction(transaction_id: UUID,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db)) -> Transaction:
    transaction: Transaction = await transaction_service.get_transaction(db=db,
                                                                         transaction_id=transaction_id,
                                                                         user_id=user_id)
    return transaction


@router.delete('/{transaction_id}')
async def delete_transaction(transaction_id: UUID,
                             transaction_type: TransactionType,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> Transaction:
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=transaction_type)
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_id)
    return transaction
