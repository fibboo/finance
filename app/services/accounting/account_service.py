from uuid import UUID

from pydantic import TypeAdapter
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.crud.accounting.account import account_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import AccountDeletionForbidden, MaxAccountsReached
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.account import Account, AccountCreate, AccountCreateRequest, AccountType, AccountUpdate
from app.schemas.base import CurrencyType, EntityStatusType

logger = get_logger(__name__)


async def create_account(db: AsyncSession,
                         create_data: AccountCreateRequest,
                         user_id: UUID) -> Account:
    user_accounts_count: int = await account_crud.count(db=db, user_id=user_id)
    if user_accounts_count >= settings.max_accounts_per_user:
        raise MaxAccountsReached(user_id=user_id, logger=logger)

    create_data: AccountCreate = AccountCreate(**create_data.model_dump(), user_id=user_id)
    try:
        account_db: AccountModel = await account_crud.create(db=db, obj_in=create_data)

    except IntegrityError as exc:
        raise IntegrityException(entity=AccountModel, exception=exc, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def create_standard_accounts(db: AsyncSession, user_id: UUID, base_currency: CurrencyType) -> None:
    create_data: list[AccountCreate] = []
    for account_type in AccountType:
        create_data.append(AccountCreate(name=f'{account_type.value.title()} {base_currency.value}',
                                         currency=base_currency,
                                         account_type=account_type,
                                         user_id=user_id))
    await account_crud.create_batch(db=db, objs_in=create_data)


async def get_accounts(db: AsyncSession, user_id: UUID) -> list[Account]:
    accounts_db: list[AccountModel] = await account_crud.get_batch(db=db,
                                                                   user_id=user_id,
                                                                   status=EntityStatusType.ACTIVE)

    accounts: list[Account] = TypeAdapter(list[Account]).validate_python(accounts_db)
    return accounts


async def get_account(db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(db=db,
                                                                     id=account_id,
                                                                     user_id=user_id,
                                                                     status=EntityStatusType.ACTIVE)
    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={'id': account_id, 'user_id': user_id}, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def update_account(db: AsyncSession, account_id: UUID, update_data: AccountUpdate, user_id: UUID) -> Account:
    try:
        account_db: AccountModel | None = await account_crud.update_orm(db=db,
                                                                        obj_in=update_data,
                                                                        id=account_id,
                                                                        user_id=user_id,
                                                                        status=EntityStatusType.ACTIVE)
    except IntegrityError as exc:
        raise IntegrityException(entity=AccountModel, exception=exc, logger=logger)

    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={'id': account_id, 'user_id': user_id}, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def delete_account(db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(db=db,
                                                                     id=account_id,
                                                                     user_id=user_id,
                                                                     status=EntityStatusType.ACTIVE,
                                                                     with_for_update=True)
    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={'id': account_id, 'user_id': user_id}, logger=logger)

    if account_db.balance != 0:
        raise AccountDeletionForbidden(account_id=account_id, logger=logger)

    obj_in: dict = {'status': EntityStatusType.DELETED.value}
    account_db: AccountModel = await account_crud.update_orm(db=db,
                                                             obj_in=obj_in,
                                                             id=account_id,
                                                             user_id=user_id,
                                                             status=EntityStatusType.ACTIVE)
    account: Account = Account.model_validate(account_db)
    return account
