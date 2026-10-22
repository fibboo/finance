from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import AccountDeletionForbidden
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountKindMismatch
from app.models.accounting.account import Account as AccountModel
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
from app.utils import utils

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


async def create_account(
    *, db: AsyncSession, create_data: AccountCreateRequest, user_id: UUID, base_currency: CurrencyCode
) -> Account:
    if create_data.currency is not None:
        await currency_service.get_currency(db=db, code=create_data.currency)

    base_currency_rate: Decimal = utils.get_new_account_base_currency_rate(
        currency=create_data.currency, base_currency=base_currency
    )
    create_data: AccountCreate = AccountCreate(
        **create_data.model_dump(), user_id=user_id, base_currency_rate=base_currency_rate
    )
    try:
        account_db: AccountModel = await account_crud.create(db=db, obj_in=create_data)

    except IntegrityError as exc:
        raise IntegrityException(entity=AccountModel, exception=exc, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def create_default_accounts(*, db: AsyncSession, user_id: UUID, base_currency: CurrencyCode) -> None:
    wallet_base_currency_rate: Decimal = utils.get_new_account_base_currency_rate(
        currency=base_currency, base_currency=base_currency
    )
    create_data: list[AccountCreate] = [
        AccountCreate(
            user_id=user_id,
            kind=AccountKind.ASSET,
            name="Wallet",
            currency=base_currency,
            base_currency_rate=wallet_base_currency_rate,
        )
    ]
    for name, category_type in DEFAULT_CATEGORIES.items():
        create_data.append(
            AccountCreate(
                user_id=user_id,
                kind=AccountKind.EXPENSE,
                name=name,
                category_type=category_type,
                base_currency_rate=Decimal("0"),
            )
        )

    create_data.append(
        AccountCreate(user_id=user_id, kind=AccountKind.EQUITY, name="Adjustments", base_currency_rate=Decimal("0"))
    )
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

    is_category_type_sent: bool = "category_type" in update_data.model_fields_set
    is_expense_account: bool = account_db.kind == AccountKind.EXPENSE
    if is_category_type_sent and is_expense_account != (update_data.category_type is not None):
        raise AccountKindMismatch(account_id=account_id, kinds=[AccountKind.EXPENSE], logger=logger)

    try:
        account_db: AccountModel = await account_crud.update_orm(
            db=db, obj_in=update_data, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
        )
    except IntegrityError as exc:
        raise IntegrityException(entity=AccountModel, exception=exc, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account


async def delete_account(*, db: AsyncSession, account_id: UUID, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE, with_for_update=True
    )
    if account_db is None or account_db.kind == AccountKind.EQUITY:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    if account_db.kind in MONEY_ACCOUNT_KINDS and account_db.balance != 0:
        raise AccountDeletionForbidden(account_id=account_id, logger=logger)

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
        raise IntegrityException(entity=AccountModel, exception=exc, logger=logger)

    account: Account = Account.model_validate(account_db)
    return account
