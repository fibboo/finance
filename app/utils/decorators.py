from functools import wraps

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.transaction.account import account_crud
from app.schemas.base import EntityStatusType
from app.schemas.transaction.account import Account
from app.schemas.transaction.transaction import Transaction


def update_balances(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        transaction: Transaction = func(*args, **kwargs)
        db: AsyncSession = kwargs['db']

        if transaction.status == EntityStatusType.DELETED:
            to_account: Account = transaction.from_account
            from_account: Account = transaction.to_account
        else:
            to_account: Account = transaction.to_account
            from_account: Account = transaction.from_account

        await account_crud.update(db=db,
                                  id=to_account.id,
                                  obj_in={'balance': to_account.balance + to_account.transaction_amount})
        await account_crud.update(db=db,
                                  id=from_account.id,
                                  obj_in={'balance': from_account.balance - from_account.transaction_amount})

        return transaction

    return wrapper
