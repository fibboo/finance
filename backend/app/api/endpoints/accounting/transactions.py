from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_db, get_onboarded_user_id, get_user_id
from app.schemas.accounting.transaction import (
    MovementRequest,
    Transaction,
    TransactionRequest,
    TransactionType,
)
from app.services.accounting import transaction_service
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor

router = APIRouter()


@router.post("")
async def create_transaction(
    *,
    create_data: MovementRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Transaction:
    """
    Moves money from one account to another. The kinds of the two accounts give the transaction type:
    a money (ASSET or LIABILITY) account to an EXPENSE account is an expense, an INCOME account to a money account
    is an income, and a money account to another money account is a transfer. Any other pair is refused with
    `MOVEMENT_NOT_ALLOWED`.

    **Transaction fields:**
    - `source_amount` — Amount in the withdrawal currency
    - `source_currency` — Withdrawal currency
    - `destination_amount` — Amount in the receiving currency
    - `destination_currency` — Receiving currency
    - `base_currency_amount` — Amount in the user's base currency

    **Context-specific behavior:**
    - **Expenses:** `source_*` refers to the amount **withdrawn from the account**.
    `destination_*` refers to the amount in **the seller's currency**. `location_id` is required,
    `income_period` and `base_currency_amount` are refused.
    - **Income:** `source_*` refers to the incoming amount in **its original currency**.
    `destination_*` refers to the credited amount in **the receiving account**. `income_period` is required and
    `location_id` refused. `base_currency_amount` is required when neither currency is the base currency,
    and refused otherwise, since it is then derived.
    - **Transfers:** `source_*` refers to **the withdrawal from one account**.
    `destination_*` refers to the deposit to **another account**. When both currencies are the same,
    `destination_amount` may be omitted and otherwise must equal `source_amount`. When only `destination_currency`
    is the base currency, `destination_amount` is derived from the source account's rate and must not be sent.
    `location_id`, `income_period` and `base_currency_amount` are refused.
    """
    transaction: Transaction = await transaction_service.create_transaction(
        db=db, create_data=create_data, user_id=user_id
    )
    return transaction


@router.get("")
async def get_transactions(
    *,
    request: Annotated[TransactionRequest, Query()],
    user_id: UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
) -> Page[Transaction]:
    """
    Lists the user's transactions page by page.

    `date_to` defaults to today in UTC, and without `date_from` the list starts at the first transaction; a
    `date_from` later than `date_to` is refused. `account_ids` of one kind match a transaction with a posting on any
    of them, and kinds combine: a transaction is listed only when it has a posting on a listed account of every kind
    sent. ASSET and LIABILITY accounts count as one kind, so a card and a category list the card's expenses in that
    category. An id that is not one of the user's accounts leaves the list empty. Transactions that tie on the
    sort fields follow the order they were entered or last edited in, in the direction of the first order.
    """
    transactions: Page[Transaction] = await transaction_service.get_transactions(
        db=db, request=request, user_id=user_id
    )
    return transactions


@router.get("/{transaction_id}")
async def get_transaction(
    *, transaction_id: UUID, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> Transaction:
    transaction: Transaction = await transaction_service.get_transaction(
        db=db, transaction_id=transaction_id, user_id=user_id
    )
    return transaction


@router.put("/{transaction_id}")
async def update_transaction(
    *,
    transaction_id: UUID,
    update_data: MovementRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Transaction:
    """
    Replaces an expense, an income or a transfer with the movement sent, keeping its id. The body is the one of
    `POST /accounting/transactions`, with the same rules by type:
    - **Expenses:** `location_id` and `destination_amount` are required, `income_period` and `base_currency_amount`
    are refused.
    - **Income:** `income_period` and `destination_amount` are required and `location_id` refused.
    `base_currency_amount` is required when neither currency is the base currency, and refused otherwise.
    - **Transfers:** `location_id`, `income_period` and `base_currency_amount` are refused, and `destination_amount`
    depends on the currencies. With one currency it may be omitted, and a value sent must equal `source_amount`.
    When only `destination_currency` is the base currency, it is derived from the source account's rate and must not
    be sent. In any other case of two currencies it is required.

    The two accounts are checked before the transaction: an unknown one answers `ENTITY_NOT_FOUND` and a pair that is
    no movement `MOVEMENT_NOT_ALLOWED`, even for a transaction that would answer `ENTITY_NOT_FOUND` itself, as a
    missing or deleted one does. Accounts that give another type than the transaction's own answer
    `TRANSACTION_TYPE_CHANGE_NOT_ALLOWED`, as does a balance adjustment, which is edited through
    `PUT /accounting/accounts/{account_id}/adjustment/{transaction_id}`, and a transaction on a deleted money account
    `DELETED_ACCOUNT_TRANSACTION_FORBIDDEN`. The old postings are then removed and their accounts
    recalculated, and the new postings pass the checks of creation on that ledger, so a transfer from an account
    without a rate answers `NO_ACCOUNT_BASE_CURRENCY_RATE`. The edited transaction moves to the end of its date, as a
    new one is placed, and the accounts of its new postings are recalculated from that date.
    """
    transaction: Transaction = await transaction_service.update_transaction(
        db=db, transaction_id=transaction_id, update_data=update_data, user_id=user_id
    )
    return transaction


@router.delete("/{transaction_id}")
async def delete_transaction(
    *,
    transaction_id: UUID,
    transaction_type: TransactionType,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Transaction:
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=transaction_type
    )
    transaction: Transaction = await transaction_processor.delete(transaction_id=transaction_id)
    return transaction
