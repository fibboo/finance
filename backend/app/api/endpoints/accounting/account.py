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
    user_id: UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
) -> Account:
    """
    With `date`, `balance`, `base_currency_balance` and `base_currency_rate` are the ones the account had on that date,
    which a balance adjustment on that date is checked against.
    """
    account: Account = await account_service.get_account(
        db=db, account_id=account_id, user_id=user_id, balance_date=balance_date
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
async def restore_account(*, account_id: UUID, user_id: UUID = Depends(get_user_id), db: DbTransaction) -> Account:
    """
    Restoring account is possible only if no active account has its name
    """
    account: Account = await account_service.restore_account(db=db, account_id=account_id, user_id=user_id)
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
    Sets the account to `new_balance` with an ADJUSTMENT transaction between the account and the Adjustments account.
    Its amounts are the difference from the current balance in the account currency. `base_currency_amount` is
    required only for an account outside the base currency that has no base currency rate yet.
    """
    transaction: Transaction = await transaction_service.adjust_balance(
        db=db, account_id=account_id, adjustment_data=adjustment_data, user_id=user_id
    )
    return transaction
