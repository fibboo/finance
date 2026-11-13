from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_db, get_onboarded_user_id, get_user_id
from app.schemas.accounting.account import (
    Account,
    AccountCreateRequest,
    AccountRequest,
    AccountRestoreRequest,
    AccountUpdate,
    AdjustmentRequest,
)
from app.schemas.accounting.transaction import Transaction
from app.services.accounting import account_service, transaction_service

router = APIRouter()


@router.post("")
async def create_account(
    *,
    create_data: AccountCreateRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Account:
    account: Account = await account_service.create_account(db=db, create_data=create_data, user_id=user_id)
    return account


@router.get("")
async def get_accounts(
    *,
    request: Annotated[AccountRequest, Query()],
    user_id: UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
) -> Page[Account]:
    accounts: Page[Account] = await account_service.get_accounts(db=db, request=request, user_id=user_id)
    return accounts


@router.get("/{account_id}")
async def get_account(
    *,
    account_id: UUID,
    balance_date: Annotated[date | None, Query(alias="date")] = None,
    excluded_transaction_id: UUID | None = None,
    user_id: UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
) -> Account:
    """
    With `date`, `balance`, `base_currency_balance` and `base_currency_rate` are the sums that decide whether the account
    has a rate for a balance adjustment on that date: its postings up to that date, without the expenses still waiting
    for a value on it. An account outside the base currency with a rate of 0 or less has none, so its adjustment must
    carry `base_currency_amount`. With `excluded_transaction_id` next to `date`, the sums leave that transaction's
    postings out, for a client that edits that adjustment. The read only subtracts the postings, while the update
    also revalues the account without them, so the update may still decide otherwise and answer
    `NO_ACCOUNT_BASE_CURRENCY_RATE` or `BASE_CURRENCY_AMOUNT_NOT_ALLOWED`.
    """
    account: Account = await account_service.get_account(
        db=db,
        account_id=account_id,
        user_id=user_id,
        balance_date=balance_date,
        excluded_transaction_id=excluded_transaction_id,
    )
    return account


@router.put("/{account_id}")
async def update_account(
    *,
    account_id: UUID,
    update_data: AccountUpdate,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Account:
    account: Account = await account_service.update_account(
        db=db, account_id=account_id, update_data=update_data, user_id=user_id
    )
    return account


@router.delete("/{account_id}")
async def delete_account(*, account_id: UUID, user_id: UUID = Depends(get_user_id), db: DbTransaction) -> Account:
    """
    Deleting an ASSET or LIABILITY account is possible only if balance is 0
    """
    account: Account = await account_service.delete_account(db=db, account_id=account_id, user_id=user_id)
    return account


@router.post("/{account_id}/restore")
async def restore_account(
    *,
    account_id: UUID,
    restore_data: AccountRestoreRequest | None = None,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Account:
    """
    Restores the account under `name` when the body gives one, and under its own name otherwise. Restoring is possible
    only if no active account of the same kind holds that name.
    """
    account: Account = await account_service.restore_account(
        db=db, account_id=account_id, restore_data=restore_data, user_id=user_id
    )
    return account


@router.post("/{account_id}/adjustment")
async def adjust_balance(
    *,
    account_id: UUID,
    adjustment_data: AdjustmentRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Transaction:
    """
    Changes the balance by `amount` with an ADJUSTMENT transaction between the account and the Adjustments account.
    `amount` is in the account currency: a positive one increases the balance, a negative one decreases it, and zero
    is refused. `base_currency_amount` is required only for an account outside the base currency that has no base
    currency rate on the date, and refused otherwise.
    """
    transaction: Transaction = await transaction_service.adjust_balance(
        db=db, account_id=account_id, adjustment_data=adjustment_data, user_id=user_id
    )
    return transaction


@router.put("/{account_id}/adjustment/{transaction_id}")
async def update_adjustment(
    *,
    account_id: UUID,
    transaction_id: UUID,
    adjustment_data: AdjustmentRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Transaction:
    """
    Replaces the amount, date and comment of an ADJUSTMENT transaction of the account, keeping its id. The body is
    the one of `POST /accounting/accounts/{account_id}/adjustment`. The account is never changed: a transaction that
    is not on this account answers `ENTITY_NOT_FOUND`, a transaction of another type
    `TRANSACTION_TYPE_CHANGE_NOT_ALLOWED` and one on a deleted account `DELETED_ACCOUNT_TRANSACTION_FORBIDDEN`.
    `base_currency_amount` follows the rule of a create on the ledger without the transaction, which
    `GET /accounting/accounts/{account_id}` answers with `date` and `excluded_transaction_id`. The edited transaction
    moves to the end of its date, as a new one is placed, and the account is recalculated.
    """
    transaction: Transaction = await transaction_service.update_adjustment(
        db=db, account_id=account_id, transaction_id=transaction_id, adjustment_data=adjustment_data, user_id=user_id
    )
    return transaction
