from datetime import date, datetime, UTC
from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy import Row
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.posting import posting_crud
from app.crud.accounting.transaction import transaction_crud
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
    AccountRestoreRequest,
    AccountUpdate,
    CategoryType,
    MONEY_ACCOUNT_KINDS,
)
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import currency_service, exchange_rate_service, ledger_service

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
from app.utils import utils


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


async def _write_off_base_balance(*, db: AsyncSession, account_db: AccountModel, user_id: UUID) -> None:
    equity_account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, user_id=user_id, kind=AccountKind.EQUITY, status=EntityStatusType.ACTIVE
    )
    if equity_account_db is None:
        raise EntityNotFound(
            entity=AccountModel, search_params={"user_id": user_id, "kind": AccountKind.EQUITY}, logger=logger
        )

    transaction_data: TransactionCreate = TransactionCreate(
        user_id=user_id,
        transaction_type=TransactionType.ADJUSTMENT,
        transaction_date=datetime.now(UTC).date(),
        base_currency_amount=abs(account_db.base_balance),
    )
    postings: list[PostingCreate] = [
        PostingCreate(
            account_id=account_db.id,
            amount=Decimal("0"),
            currency=account_db.currency,
            base_amount=-account_db.base_balance,
        ),
        PostingCreate(
            account_id=equity_account_db.id,
            amount=Decimal("0"),
            currency=account_db.currency,
            base_amount=account_db.base_balance,
        ),
    ]
    await transaction_crud.create_with_postings(db=db, obj_in=transaction_data, postings=postings)
    await account_crud.add_to_balance(
        db=db, account_id=account_db.id, amount=Decimal("0"), base_amount=-account_db.base_balance
    )


def get_unvalued_estimates(
    *, accounts_db: list[AccountModel], unvalued_sums: list[Row], base_currency_rates: dict[CurrencyCode, Decimal]
) -> dict[UUID, Decimal | None]:
    currencies: dict[UUID, CurrencyCode] = {account_db.id: account_db.currency for account_db in accounts_db}
    unvalued_estimates: dict[UUID, Decimal | None] = {}
    for unvalued_sum in unvalued_sums:
        unvalued_estimates[unvalued_sum.account_id] = exchange_rate_service.get_estimate(
            amount=unvalued_sum.amount,
            currency=currencies[unvalued_sum.account_id],
            base_currency_rates=base_currency_rates,
        )

    return unvalued_estimates


def _add_estimates(*, accounts: list[Account], unvalued_estimates: dict[UUID, Decimal | None]) -> None:
    for account in accounts:
        unvalued_estimate: Decimal | None = unvalued_estimates.get(account.id)
        if unvalued_estimate is not None:
            account.estimated_base_balance = account.base_currency_balance + unvalued_estimate


async def get_accounts(*, db: AsyncSession, request: AccountRequest, user_id: UUID) -> Page[Account]:
    recent_use_dates: tuple[date, date] = utils.get_recent_use_dates(today=datetime.now(UTC).date())
    accounts_db: Page[AccountModel] = await account_crud.get_accounts(
        db=db, request=request, user_id=user_id, recent_use_dates=recent_use_dates
    )
    accounts: Page[Account] = Page[Account].model_validate(accounts_db)

    money_account_ids: list[UUID] = []
    for account_db in accounts_db.items:
        if account_db.kind in MONEY_ACCOUNT_KINDS:
            money_account_ids.append(account_db.id)

    if len(money_account_ids) == 0:
        return accounts

    unvalued_sums: list[Row] = await posting_crud.get_unvalued_sums(db=db, account_ids=money_account_ids)
    if len(unvalued_sums) == 0:
        return accounts

    base_currency_rates: dict[CurrencyCode, Decimal] = await exchange_rate_service.get_base_currency_rates(
        db=db, user_id=user_id
    )
    unvalued_estimates: dict[UUID, Decimal | None] = get_unvalued_estimates(
        accounts_db=list(accounts_db.items), unvalued_sums=unvalued_sums, base_currency_rates=base_currency_rates
    )
    _add_estimates(accounts=accounts.items, unvalued_estimates=unvalued_estimates)
    return accounts


async def get_account(
    *,
    db: AsyncSession,
    account_id: UUID,
    user_id: UUID,
    balance_date: date | None = None,
    excluded_transaction_id: UUID | None = None,
) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    if account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    account: Account = Account.model_validate(account_db)
    if account_db.kind not in MONEY_ACCOUNT_KINDS:
        return account

    if balance_date is not None:
        account.balance, account.base_balance = await ledger_service.get_balances_at_date(
            db=db,
            account_db=account_db,
            transaction_date=balance_date,
            excluded_transaction_id=excluded_transaction_id,
        )
        return account

    unvalued_sums: list[Row] = await posting_crud.get_unvalued_sums(db=db, account_ids=[account_db.id])
    if len(unvalued_sums) == 0:
        return account

    base_currency_rates: dict[CurrencyCode, Decimal] = await exchange_rate_service.get_base_currency_rates(
        db=db, user_id=user_id
    )
    unvalued_estimates: dict[UUID, Decimal | None] = get_unvalued_estimates(
        accounts_db=[account_db], unvalued_sums=unvalued_sums, base_currency_rates=base_currency_rates
    )
    _add_estimates(accounts=[account], unvalued_estimates=unvalued_estimates)
    return account


async def update_account(*, db: AsyncSession, account_id: UUID, update_data: AccountUpdate, user_id: UUID) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE, with_for_update=True
    )
    if account_db is None or account_db.kind == AccountKind.EQUITY:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    if update_data.category_type is not None and account_db.kind != AccountKind.EXPENSE:
        raise AccountKindMismatch(account_id=account_id, kinds=[AccountKind.EXPENSE], logger=logger)

    if update_data.color is not None and account_db.kind not in MONEY_ACCOUNT_KINDS:
        raise AccountKindMismatch(account_id=account_id, kinds=MONEY_ACCOUNT_KINDS, logger=logger)

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

    if is_money_account and account_db.base_balance != 0:
        await _write_off_base_balance(db=db, account_db=account_db, user_id=user_id)

    obj_in: dict = {"status": EntityStatusType.DELETED.value}
    account_db: AccountModel = await account_crud.update_orm(
        db=db, obj_in=obj_in, id=account_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    account: Account = Account.model_validate(account_db)
    return account


async def restore_account(
    *, db: AsyncSession, account_id: UUID, restore_data: AccountRestoreRequest | None, user_id: UUID
) -> Account:
    account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=account_id, user_id=user_id, status=EntityStatusType.DELETED, with_for_update=True
    )
    if account_db is None or account_db.kind == AccountKind.EQUITY:
        raise EntityNotFound(entity=AccountModel, search_params={"id": account_id, "user_id": user_id}, logger=logger)

    obj_in: dict = {"status": EntityStatusType.ACTIVE.value}
    if restore_data is not None and restore_data.name is not None:
        obj_in["name"] = restore_data.name

    try:
        account_db: AccountModel = await account_crud.update_orm(
            db=db, obj_in=obj_in, id=account_id, user_id=user_id, status=EntityStatusType.DELETED
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    account: Account = Account.model_validate(account_db)
    return account
