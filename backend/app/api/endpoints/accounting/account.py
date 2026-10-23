from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_base_currency, get_db, get_user_id
from app.schemas.accounting.account import Account, AccountCreateRequest, AccountRequest, AccountUpdate
from app.schemas.base import CurrencyCode
from app.services.accounting import account_service

router = APIRouter()


@router.post("")
async def create_account(
    *,
    create_data: AccountCreateRequest,
    user_id: UUID = Depends(get_user_id),
    base_currency: CurrencyCode = Depends(get_base_currency),
    db: DbTransaction,
) -> Account:
    account: Account = await account_service.create_account(
        db=db, create_data=create_data, user_id=user_id, base_currency=base_currency
    )
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
    *, account_id: UUID, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> Account:
    account: Account = await account_service.get_account(db=db, account_id=account_id, user_id=user_id)
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
