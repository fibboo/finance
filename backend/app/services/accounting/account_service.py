from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.exceptions.conflict_409 import ConflictException, IntegrityException, NameAlreadyExists
from app.exceptions.forbidden_403 import AccountDeletionForbidden, LastAccountDeletionForbidden
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountKindMismatch
from app.models.accounting.account import Account as AccountModel, ACCOUNT_UNIQUE_NAME_INDEX
from app.schemas.accounting.account import (
    Account,
    AccountCreate,
    AccountCreateRequest,
    AccountKind,
    AccountRequest,
    AccountUpdate,
    CategoryType,
    MONEY_ACCOUNT_KINDS,
)
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import currency_service

logger = get_logger(logger_name=__name__)

DEFAULT_CATEGORIES: frozendict[str, CategoryType] = frozendict(
    {
        "Groceries": CategoryType.VARIABLE,
        "Eating out": CategoryType.VARIABLE,
        "Transport": CategoryType.VARIABLE,
        "Utilities": CategoryType.FIXED,
        "Subscriptions": CategoryType.FIXED,
        "Travel": CategoryType.PERIODIC,
        "Health": CategoryType.PERIODIC,
        "Clothing": CategoryType.PERIODIC,
    }
)


def _get_integrity_exception(*, exception: IntegrityError, user_id: UUID) -> ConflictException:
    if exception.driver_exception.constraint_name == ACCOUNT_UNIQUE_NAME_INDEX:
        name_exception = NameAlreadyExists(entity=AccountModel, user_id=user_id, logger=logger)
        return name_exception

    integrity_exception = IntegrityException(entity=AccountModel, exception=exception, logger=logger)
    return integrity_exception


async def create_account(*, db: AsyncSession, create_data: AccountCreateRequest, user_id: UUID) -> Account:
    if create_data.currency is not None:
        await currency_service.get_currency(db=db, code=create_data.currency)

    create_data: AccountCreate = AccountCreate(**create_data.model_dump(), user_id=user_id)
    try:
        account_db: AccountModel = await account_crud.create(db=db, obj_in=create_data)

    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    account: Account = Account.model_validate(account_db)
    return account


async def create_default_accounts(*, db: AsyncSession, user_id: UUID, base_currency: CurrencyCode) -> None:
    create_data: list[AccountCreate] = [
        AccountCreate(user_id=user_id, kind=AccountKind.ASSET, name="Wallet", currency=base_currency)
    ]
    for name, category_type in DEFAULT_CATEGORIES.items():
        create_data.append(
            AccountCreate(user_id=user_id, kind=AccountKind.EXPENSE, name=name, category_type=category_type)
        )

    create_data.append(AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments"))
    await account_crud.create_batch(db=db, objs_in=create_data)


async def get_accounts(*, db: AsyncSession, request: AccountRequest, user_id: UUID) -> Page[Account]:
    accounts_db: Page[AccountModel] = await account_crud.get_accounts(db=db, request=request, user_id=user_id)
    accounts: Page[Account] = Page[Account].model_validate(accounts_db)
    return accounts


async def get_account(*, db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def update_account(*, db: AsyncSession, account_id: UUID, update_data: AccountUpdate, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE, with_for_update=True
    )
    if account_db is None or account_db.kind == AccountKind.EQUITY:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    if update_data.category_type is not None and account_db.kind != AccountKind.EXPENSE:
        raise AccountKindMismatch(account_id=account_id, kinds=[AccountKind.EXPENSE], logger=logger)

    try:
        account_db: AccountModel = await account_crud.update_orm(
            db=db, obj_in=update_data, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    account: Account = Account.model_validate(account_db)
    return account


async def delete_account(*, db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    if account_db is None or account_db.kind == AccountKind.EQUITY:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    is_money_account: bool = account_db.kind in MONEY_ACCOUNT_KINDS
    if is_money_account:
        locked_accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_active_money_accounts(
            db=db, user_id=user_id
        )
    else:
        locked_accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=db, ids=[account_id], user_id=user_id, status=EntityStatusType.ACTIVE
        )

    account_db: AccountModel | None = locked_accounts_db.get(account_id)
    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    if is_money_account and account_db.balance != 0:
        raise AccountDeletionForbidden(account_id=account_id, logger=logger)

    if is_money_account and len(locked_accounts_db) == 1:
        raise LastAccountDeletionForbidden(account_id=account_id, logger=logger)

    obj_in: dict = {"status": EntityStatusType.DELETED.value}
    account_db: AccountModel = await account_crud.update_orm(
        db=db, obj_in=obj_in, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    account: Account = Account.model_validate(account_db)
    return account


async def restore_account(*, db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.DELETED, with_for_update=True
    )
    if account_db is None or account_db.kind == AccountKind.EQUITY:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    obj_in: dict = {"status": EntityStatusType.ACTIVE.value}
    try:
        account_db: AccountModel = await account_crud.update_orm(
            db=db, obj_in=obj_in, id=account_id, user_id=user_id, status=EntityStatusType.DELETED
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    account: Account = Account.model_validate(account_db)
    return account
