from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction

from app.api.deps import get_db, get_db_transaction, get_user_id
from app.schemas.transaction.account import Account, AccountCreateRequest
from app.services.transaction import account_service

router = APIRouter()


@router.post('')
async def create_account(account_create: AccountCreateRequest,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSessionTransaction = Depends(get_db_transaction)) -> Account:
    account: Account = await account_service.create_account(db=db, account_create=account_create, user_id=user_id)
    return account


@router.get('')
async def get_accounts(user_id: UUID = Depends(get_user_id),
                       db: AsyncSession = Depends(get_db)) -> list[Account]:
    accounts: list[Account] = await account_service.get_accounts(db=db, user_id=user_id)
    return accounts


@router.get('/{account_id}')
async def get_account(account_id: UUID,
                      user_id: UUID = Depends(get_user_id),
                      db: AsyncSession = Depends(get_db)) -> Account:
    account: Account = await account_service.get_account(db=db, account_id=account_id, user_id=user_id)
    return account
