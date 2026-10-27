from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.posting import posting_crud
from app.crud.accounting.transaction import transaction_crud
from app.crud.user.authorization_request import authorization_request_crud
from app.crud.user.external_user import external_user_crud
from app.crud.user.refresh_token import refresh_token_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import BaseCurrencyMismatch, ProviderAlreadyLinked
from app.exceptions.unauthorized_401 import InvalidTokenException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.user.authorization_request import AuthorizationRequest as AuthorizationRequestModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountKind
from app.schemas.base import EntityStatusType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import User
from app.utils import utils

logger = get_logger(logger_name=__name__)

FOLDED_ACCOUNT_KINDS: list[AccountKind] = [AccountKind.EXPENSE, AccountKind.INCOME, AccountKind.EQUITY]


def is_base_currency_mismatch(*, user_db: UserModel, merge_user_db: UserModel) -> bool:
    is_base_currency_set: bool = user_db.base_currency is not None and merge_user_db.base_currency is not None
    is_mismatch: bool = is_base_currency_set and user_db.base_currency != merge_user_db.base_currency
    return is_mismatch


def get_shared_providers(*, user_db: UserModel, merge_user_db: UserModel) -> list[ProviderType]:
    providers: set[ProviderType] = {external_user.provider for external_user in user_db.external_users}
    merge_providers: set[ProviderType] = {external_user.provider for external_user in merge_user_db.external_users}
    shared_providers: list[ProviderType] = sorted(providers & merge_providers)
    return shared_providers


def _build_free_name(*, name: str, taken_names: set[str]) -> str:
    number: int = 1
    free_name: str = name
    while free_name in taken_names:
        number += 1
        suffix: str = f" {number}"
        free_name = f"{name[: AccountModel.name.type.length - len(suffix)].rstrip()}{suffix}"

    return free_name


async def _get_merge_request(
    *, db: AsyncSession, user_id: UUID, merge_code: str, with_for_update: bool
) -> AuthorizationRequestModel:
    request_db: AuthorizationRequestModel | None = await authorization_request_crud.get_by_merge_code_hash(
        db=db, merge_code_hash=utils.hash_secret(secret=merge_code), with_for_update=with_for_update
    )
    if request_db is None or request_db.merge_expires_at <= datetime.now():
        raise InvalidTokenException(log_message="Unknown, used or expired merge code", logger=logger)

    if request_db.link_user_id != user_id:
        raise InvalidTokenException(log_message=f"Merge code of `{request_db.id}` is not for this user", logger=logger)

    return request_db


async def _move_accounts(*, db: AsyncSession, user_id: UUID, merge_user_id: UUID) -> None:
    accounts_db: list[AccountModel] = await account_crud.get_user_accounts(db=db, user_id=user_id)
    merge_accounts_db: list[AccountModel] = await account_crud.get_user_accounts(db=db, user_id=merge_user_id)
    active_account_ids: dict[tuple[AccountKind, str], UUID] = {}
    taken_names: dict[AccountKind, set[str]] = {}
    for account_db in [*accounts_db, *merge_accounts_db]:
        if account_db.status != EntityStatusType.ACTIVE:
            continue

        taken_names.setdefault(account_db.kind, set()).add(account_db.name)
        if account_db.user_id == user_id:
            active_account_ids[(account_db.kind, account_db.name)] = account_db.id

    folded_account_ids: dict[UUID, UUID] = {}
    names: dict[UUID, str] = {}
    for merge_account_db in merge_accounts_db:
        account_id: UUID | None = active_account_ids.get((merge_account_db.kind, merge_account_db.name))
        if merge_account_db.status != EntityStatusType.ACTIVE or account_id is None:
            continue

        if merge_account_db.kind in FOLDED_ACCOUNT_KINDS:
            folded_account_ids[merge_account_db.id] = account_id
            continue

        kind_taken_names: set[str] = taken_names[merge_account_db.kind]
        name: str = _build_free_name(name=merge_account_db.name, taken_names=kind_taken_names)
        kind_taken_names.add(name)
        names[merge_account_db.id] = name

    await posting_crud.update_account_ids(db=db, account_ids=folded_account_ids)
    await account_crud.delete_by_ids(db=db, ids=list(folded_account_ids))
    await account_crud.update_names(db=db, names=names)
    await account_crud.move_to_user(db=db, user_id=merge_user_id, new_user_id=user_id)


async def _move_locations(*, db: AsyncSession, user_id: UUID, merge_user_id: UUID) -> None:
    locations_db: list[LocationModel] = await location_crud.get_user_locations(db=db, user_id=user_id)
    merge_locations_db: list[LocationModel] = await location_crud.get_user_locations(db=db, user_id=merge_user_id)
    active_location_ids: dict[str, UUID] = {}
    for location_db in locations_db:
        if location_db.status == EntityStatusType.ACTIVE:
            active_location_ids[location_db.name] = location_db.id

    folded_location_ids: dict[UUID, UUID] = {}
    for merge_location_db in merge_locations_db:
        location_id: UUID | None = active_location_ids.get(merge_location_db.name)
        if merge_location_db.status == EntityStatusType.ACTIVE and location_id is not None:
            folded_location_ids[merge_location_db.id] = location_id

    await transaction_crud.update_location_ids(db=db, location_ids=folded_location_ids)
    await location_crud.delete_by_ids(db=db, ids=list(folded_location_ids))
    await location_crud.move_to_user(db=db, user_id=merge_user_id, new_user_id=user_id)


async def merge(*, db: AsyncSession, user_id: UUID, merge_code: str) -> User:
    request_db: AuthorizationRequestModel = await _get_merge_request(
        db=db, user_id=user_id, merge_code=merge_code, with_for_update=False
    )
    merge_user_id: UUID = request_db.merge_user_id

    users_db: dict[UUID, UserModel] = await user_crud.get_locked_by_ids(db=db, ids=[user_id, merge_user_id])
    await _get_merge_request(db=db, user_id=user_id, merge_code=merge_code, with_for_update=True)
    user_db: UserModel = users_db[user_id]
    merge_user_db: UserModel = users_db[merge_user_id]
    is_mismatch: bool = is_base_currency_mismatch(user_db=user_db, merge_user_db=merge_user_db)
    if is_mismatch:
        raise BaseCurrencyMismatch(user_id=user_id, merge_user_id=merge_user_id, logger=logger)

    shared_providers: list[ProviderType] = get_shared_providers(user_db=user_db, merge_user_db=merge_user_db)
    if len(shared_providers) > 0:
        raise ProviderAlreadyLinked(user_id=user_id, provider=shared_providers[0], logger=logger)

    await account_crud.lock_money_accounts(db=db, user_id=user_id)
    await account_crud.lock_money_accounts(db=db, user_id=merge_user_id)

    if user_db.base_currency is None:
        await user_crud.update_orm(db=db, obj_in={"base_currency": merge_user_db.base_currency}, id=user_id)

    await _move_accounts(db=db, user_id=user_id, merge_user_id=merge_user_id)
    await _move_locations(db=db, user_id=user_id, merge_user_id=merge_user_id)
    await transaction_crud.move_to_user(db=db, user_id=merge_user_id, new_user_id=user_id)
    await external_user_crud.move_to_user(db=db, user_id=merge_user_id, new_user_id=user_id)
    await refresh_token_crud.delete_by_user(db=db, user_id=merge_user_id)
    await authorization_request_crud.delete_by_user(db=db, user_id=merge_user_id)
    await user_crud.delete_by_id(db=db, user_id=merge_user_id)

    merged_user_db: UserModel = await user_crud.get_refreshed(db=db, user_id=user_id)
    merged_user: User = User.model_validate(merged_user_db)
    return merged_user
