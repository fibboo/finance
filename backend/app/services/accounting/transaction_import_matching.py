from collections import defaultdict
from dataclasses import dataclass
from typing import TypeAlias
from uuid import UUID

from pydantic import ValidationError

from app.configs.logging_settings import get_logger
from app.exceptions.unprocessable_422 import ImportDecisionsInvalid
from app.models.accounting.account import Account
from app.models.accounting.classification import Classification
from app.models.accounting.location import Location
from app.schemas.accounting.account import AccountCreateRequest, AccountKind, CategoryPurpose
from app.schemas.accounting.classification import ClassificationKind
from app.schemas.accounting.transaction import TransactionType
from app.schemas.accounting.transaction_import import (
    ImportColumn,
    ImportEntityAction,
    ImportEntityDecision,
    ImportEntityGroup,
    ImportEntityKind,
    ImportMatchIssue,
    ImportNewEntity,
    ImportRowError,
    ImportRowErrorCode,
    TransactionImportRow,
)
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import classification_service

logger = get_logger(logger_name=__name__)

_ACCOUNT_KINDS: dict[ImportEntityKind, AccountKind] = {
    ImportEntityKind.MONEY_ACCOUNT: AccountKind.ASSET,
    ImportEntityKind.CATEGORY: AccountKind.EXPENSE,
    ImportEntityKind.INCOME_SOURCE: AccountKind.INCOME,
}
_ENTITY_KINDS: dict[AccountKind, ImportEntityKind] = {kind: entity_kind for entity_kind, kind in _ACCOUNT_KINDS.items()}
_MONEY: ImportEntityKind = ImportEntityKind.MONEY_ACCOUNT
_LOCATION: ImportEntityKind = ImportEntityKind.LOCATION
_NO_LOCATION: str = "No location"

GroupKey: TypeAlias = tuple[ImportEntityKind, str | None, CurrencyCode | None]
EntityIdentity: TypeAlias = UUID | tuple[ImportEntityKind, str, UUID | None]


@dataclass(frozen=True)
class EntityMatches:
    groups: list[ImportEntityGroup]
    assignments: dict[tuple[int, ImportColumn], EntityIdentity]


@dataclass(frozen=True)
class _Role:
    column: ImportColumn
    kind: ImportEntityKind
    name: str | None
    currency: CurrencyCode | None = None


def match_entities(
    *,
    rows: list[TransactionImportRow],
    accounts: list[Account],
    locations: list[Location],
    classifications: list[Classification],
    decisions: list[ImportEntityDecision],
    validate_decisions: bool = False,
) -> EntityMatches:
    grouped_roles: dict[GroupKey, dict[int, list[_Role]]] = defaultdict(lambda: defaultdict(list))
    rows_by_number: dict[int, TransactionImportRow] = {row.row_number: row for row in rows}
    for row in rows:
        for role in _get_roles(row=row):
            key: GroupKey = _group_key(kind=role.kind, name=role.name, currency=role.currency)
            grouped_roles[key][row.row_number].append(role)

    entities_by_kind: dict[ImportEntityKind, list[Account | Location]] = defaultdict(list)
    for account in accounts:
        if account.kind in _ENTITY_KINDS:
            entities_by_kind[_ENTITY_KINDS[account.kind]].append(account)

    entities_by_kind[_LOCATION] = locations
    active_by_id: dict[UUID, tuple[ImportEntityKind, Account | Location]] = {
        entity.id: (kind, entity)
        for kind, entities in entities_by_kind.items()
        for entity in entities
        if entity.status == EntityStatusType.ACTIVE
    }
    by_name: dict[tuple[ImportEntityKind, str], list[Account | Location]] = defaultdict(list)
    money_by_currency: dict[CurrencyCode, list[Account]] = defaultdict(list)
    for kind, entities in entities_by_kind.items():
        for entity in entities:
            by_name[kind, entity.name.lower()].append(entity)
            if isinstance(entity, Account) and kind == _MONEY and entity.status == EntityStatusType.ACTIVE:
                money_by_currency[entity.currency].append(entity)

    classifications_by_id: dict[UUID, ClassificationKind] = {item.id: item.kind for item in classifications}
    defaults: dict[ClassificationKind, UUID] = {item.kind: item.id for item in classifications if item.is_default}
    submitted: dict[GroupKey, list[ImportEntityDecision]] = defaultdict(list)
    for decision in decisions:
        key = _group_key(kind=decision.kind, name=decision.name, currency=decision.currency)
        if key not in grouped_roles and validate_decisions:
            raise ImportDecisionsInvalid(reason="Entity decision refers to an unknown group", logger=logger)

        submitted[key].append(decision)

    groups: list[ImportEntityGroup] = []
    assignments: dict[tuple[int, ImportColumn], EntityIdentity] = {}
    for key, roles_by_row in grouped_roles.items():
        kind, normalized_name, _ = key
        roles: list[_Role] = [role for row_roles in roles_by_row.values() for role in row_roles]
        currencies: set[CurrencyCode] = {role.currency for role in roles if role.currency is not None}
        currency: CurrencyCode | None = next(iter(currencies)) if len(currencies) == 1 else None
        name: str | None = roles[0].name
        classification_kind: ClassificationKind | None = None
        if kind in _ACCOUNT_KINDS:
            classification_kind = classification_service.get_classification_kind(account_kind=_ACCOUNT_KINDS[kind])

        default_classification: UUID | None = defaults.get(classification_kind)
        group = ImportEntityGroup(
            kind=kind,
            name=name,
            currency=currency,
            row_count=len(roles_by_row),
            issue=None,
            candidate_ids=[],
            decisions=[],
        )
        if len(currencies) > 1:
            group.issue = ImportMatchIssue.CURRENCY_CONFLICT
        elif kind == _MONEY and name is None:
            candidates: list[Account] = money_by_currency[currency]
            group.candidate_ids = [entity.id for entity in candidates]
            if len(candidates) == 1:
                group.decisions = [_existing_decision(group=group, entity_id=candidates[0].id)]
            else:
                group.issue = ImportMatchIssue.AMBIGUOUS if len(candidates) > 1 else ImportMatchIssue.UNASSIGNED
        else:
            target_name: str = name if name is not None else _NO_LOCATION
            matching: list[Account | Location] = by_name[kind, normalized_name or target_name.lower()]
            _propose_named(
                group=group, target_name=target_name, matching=matching, classification_id=default_classification
            )

        group_decisions: list[ImportEntityDecision] = submitted.get(key, group.decisions)
        unassigned: set[int] = set(roles_by_row)
        group.decisions = []
        for decision in group_decisions:
            row_numbers: set[int] = set(roles_by_row if decision.row_numbers is None else decision.row_numbers)
            if (
                len(currencies) > 1
                or decision.currency != currency
                or (
                    decision.row_numbers is not None
                    and (
                        kind != _MONEY
                        or name is not None
                        or len(row_numbers) == 0
                        or len(row_numbers) != len(decision.row_numbers)
                    )
                )
                or not row_numbers <= unassigned
            ):
                if validate_decisions:
                    raise ImportDecisionsInvalid(
                        reason="Entity decision has invalid or overlapping rows or currency", logger=logger
                    )

                continue

            identity: EntityIdentity | None = _resolve_decision(
                decision=decision,
                active_by_id=active_by_id,
                classification_kind=classification_kind,
                classifications_by_id=classifications_by_id,
                default_classification=default_classification,
            )
            if identity is None:
                if validate_decisions:
                    raise ImportDecisionsInvalid(
                        reason="Entity decision has an invalid entity or creation fields", logger=logger
                    )

                continue

            group.decisions.append(decision.model_copy(update={"name": name}))
            unassigned.difference_update(row_numbers)
            for row_number in row_numbers:
                for role in roles_by_row[row_number]:
                    assignments[row_number, role.column] = identity

        if len(unassigned) == 0:
            group.issue = None
        elif key in submitted and group.issue != ImportMatchIssue.CURRENCY_CONFLICT:
            group.issue = ImportMatchIssue.UNASSIGNED

        if group.issue is not None:
            for row_number in sorted(unassigned):
                for role in roles_by_row[row_number]:
                    rows_by_number[row_number].errors.append(_match_error(column=role.column, issue=group.issue))

        groups.append(group)

    result = EntityMatches(groups=groups, assignments=assignments)
    return result


def _group_key(*, kind: ImportEntityKind, name: str | None, currency: CurrencyCode | None) -> GroupKey:
    normalized_name: str | None = name.strip().lower() if name is not None else None
    result: GroupKey = (kind, normalized_name, currency if kind == _MONEY and normalized_name is None else None)
    return result


def _get_roles(*, row: TransactionImportRow) -> list[_Role]:
    roles: list[_Role] = []
    kind: TransactionType | None = row.transaction_type
    if kind in (TransactionType.EXPENSE, TransactionType.TRANSFER, TransactionType.ADJUSTMENT):
        if row.currency is not None:
            roles.append(_Role(column=ImportColumn.FROM, kind=_MONEY, name=row.from_name, currency=row.currency))
    elif kind == TransactionType.INCOME and row.from_name is not None:
        roles.append(_Role(column=ImportColumn.FROM, kind=ImportEntityKind.INCOME_SOURCE, name=row.from_name))

    if kind in (TransactionType.INCOME, TransactionType.TRANSFER) and row.to_currency is not None:
        roles.append(_Role(column=ImportColumn.TO, kind=_MONEY, name=row.to_name, currency=row.to_currency))
    elif kind == TransactionType.EXPENSE:
        if row.to_name is not None:
            roles.append(_Role(column=ImportColumn.TO, kind=ImportEntityKind.CATEGORY, name=row.to_name))

        roles.append(_Role(column=ImportColumn.LOCATION, kind=_LOCATION, name=row.location_name))

    invalid_columns: set[ImportColumn | None] = {error.column for error in row.errors}
    valid_roles: list[_Role] = [
        _Role(
            column=role.column,
            kind=role.kind,
            name=role.name.strip() if role.name is not None else None,
            currency=role.currency,
        )
        for role in roles
        if role.column not in invalid_columns
    ]
    return valid_roles


def _existing_decision(*, group: ImportEntityGroup, entity_id: UUID) -> ImportEntityDecision:
    decision = ImportEntityDecision(
        kind=group.kind,
        name=group.name,
        currency=group.currency,
        action=ImportEntityAction.USE_EXISTING,
        entity_id=entity_id,
    )
    return decision


def _propose_named(
    *, group: ImportEntityGroup, target_name: str, matching: list[Account | Location], classification_id: UUID | None
) -> None:
    active: list[Account | Location] = [entity for entity in matching if entity.status == EntityStatusType.ACTIVE]
    compatible: list[Account | Location] = active
    if group.kind == _MONEY:
        compatible = [entity for entity in active if entity.currency == group.currency]

    group.candidate_ids = [entity.id for entity in compatible]
    if len(compatible) == 1:
        group.decisions = [_existing_decision(group=group, entity_id=compatible[0].id)]
    elif len(compatible) > 1:
        group.issue = ImportMatchIssue.AMBIGUOUS
    elif len(active) > 0:
        group.issue = ImportMatchIssue.CURRENCY_MISMATCH
    elif len(matching) > 0 and group.name is not None:
        group.issue = ImportMatchIssue.DELETED
    else:
        try:
            new_entity = ImportNewEntity(
                name=target_name,
                currency=group.currency,
                classification_id=classification_id,
                category_purpose=CategoryPurpose.PERSONAL if group.kind == ImportEntityKind.CATEGORY else None,
            )
        except ValidationError:
            group.issue = ImportMatchIssue.UNASSIGNED
        else:
            group.decisions = [
                ImportEntityDecision(
                    kind=group.kind,
                    name=group.name,
                    currency=group.currency,
                    action=ImportEntityAction.CREATE,
                    new_entity=new_entity,
                )
            ]


def _resolve_decision(
    *,
    decision: ImportEntityDecision,
    active_by_id: dict[UUID, tuple[ImportEntityKind, Account | Location]],
    classification_kind: ClassificationKind | None,
    classifications_by_id: dict[UUID, ClassificationKind],
    default_classification: UUID | None,
) -> EntityIdentity | None:
    if decision.action == ImportEntityAction.USE_EXISTING:
        existing: tuple[ImportEntityKind, Account | Location] | None = active_by_id.get(decision.entity_id)
        if decision.new_entity is not None or existing is None or existing[0] != decision.kind:
            return None

        if decision.kind == _MONEY and existing[1].currency != decision.currency:
            return None

        return decision.entity_id

    new_entity: ImportNewEntity | None = decision.new_entity
    if (
        decision.entity_id is not None
        or new_entity is None
        or "\x00" in new_entity.name
        or new_entity.currency != decision.currency
    ):
        return None

    classification_id: UUID | None = new_entity.classification_id
    if classification_id is not None:
        if classification_kind is None or classifications_by_id.get(classification_id) != classification_kind:
            return None

    if decision.kind == _LOCATION:
        if new_entity.category_purpose is not None:
            return None
    else:
        fields: dict = new_entity.model_dump(exclude_none=True)
        try:
            AccountCreateRequest(kind=_ACCOUNT_KINDS[decision.kind], **fields)
        except ValidationError:
            return None

    identity: EntityIdentity = (decision.kind, new_entity.name.lower(), classification_id or default_classification)
    return identity


def _match_error(*, column: ImportColumn, issue: ImportMatchIssue) -> ImportRowError:
    messages: dict[ImportMatchIssue, str] = {
        ImportMatchIssue.AMBIGUOUS: "Multiple entities match this name or currency",
        ImportMatchIssue.CURRENCY_MISMATCH: "The account is in a different currency",
        ImportMatchIssue.DELETED: "The matching entity is deleted",
        ImportMatchIssue.CURRENCY_CONFLICT: "Rows with this account name use different currencies",
        ImportMatchIssue.UNASSIGNED: "Choose an entity for this row",
    }
    result = ImportRowError(column=column, code=issue, message=messages[issue], correction=None)
    return result
