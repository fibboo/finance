from uuid import UUID

from pydantic import TypeAdapter
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction

from app.configs.logging_settings import get_logger
from app.crud.transaction.account import account_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.schemas.transaction.account import Account, AccountCreate, AccountCreateRequest
from app.models.transaction.account import Account as AccountModel

logger = get_logger(__name__)


async def create_account(db: AsyncSessionTransaction,
                         account_create: AccountCreateRequest,
                         user_id: UUID) -> Account:
    account_create: AccountCreate = AccountCreate(**account_create.model_dump(), user_id=user_id)
    try:
        account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create)

    except IntegrityError as exc:
        raise IntegrityException(entity=AccountModel, exception=exc, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def get_accounts(db: AsyncSession, user_id: UUID) -> list[Account]:
    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db, user_id=user_id)

    accounts: list[Account] = TypeAdapter(list[Account]).validate_python(accounts_db)
    return accounts


async def get_account(db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(db=db, id=account_id, user_id=user_id)
    if account_db is None:
        raise EntityNotFound(entity=Account, search_params={'id': account_id}, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account
