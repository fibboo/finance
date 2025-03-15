from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_user_id
from app.schemas.accounting.account import Account, AccountCreateRequest, AccountUpdate
from app.services.accounting import account_service

router = APIRouter()


@router.post('')
async def create_account(create_data: AccountCreateRequest,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)) -> Account:
    account: Account = await account_service.create_account(db=db, create_data=create_data, user_id=user_id)
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


@router.put('/{account_id}')
async def update_account(account_id: UUID,
                         update_data: AccountUpdate,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)) -> Account:
    account: Account = await account_service.update_account(db=db,
                                                            account_id=account_id,
                                                            update_data=update_data,
                                                            user_id=user_id)
    return account


@router.delete('/{account_id}', status_code=200)
async def delete_account(account_id: UUID,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)) -> None:
    """
    Deleting account is possible only if balance is 0
    """
    await account_service.delete_account(db=db, account_id=account_id, user_id=user_id)
