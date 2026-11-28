from uuid import uuid4

import pytest

from app.exceptions.unprocessable_422 import ImportDecisionsInvalid
from app.models.accounting.account import Account
from app.models.accounting.classification import Classification
from app.models.accounting.location import Location
from app.schemas.accounting.account import AccountKind, CategoryPurpose
from app.schemas.accounting.classification import ClassificationKind
from app.schemas.accounting.transaction import TransactionType
from app.schemas.accounting.transaction_import import (
    ImportColumn,
    ImportEntityAction,
    ImportEntityDecision,
    ImportEntityKind,
    ImportMatchIssue,
    ImportNewEntity,
    TransactionImportRow,
)
from app.schemas.base import EntityStatusType
from app.services.accounting.transaction_import_matching import match_entities


def test_groups_by_role_name_and_currency_and_proposes_each_kind():
    # arrange
    rows = [
        TransactionImportRow.model_construct(
            row_number=2,
            transaction_type=TransactionType.EXPENSE,
            from_name=" Card ",
            to_name="Food",
            location_name=None,
            currency="EUR",
            errors=[],
        ),
        TransactionImportRow.model_construct(
            row_number=3,
            transaction_type=TransactionType.EXPENSE,
            from_name="CARD",
            to_name="food",
            location_name=None,
            currency="EUR",
            errors=[],
        ),
        TransactionImportRow.model_construct(
            row_number=4,
            transaction_type=TransactionType.INCOME,
            from_name="Employer",
            to_name=None,
            to_currency="EUR",
            errors=[],
        ),
    ]
    card = Account(id=uuid4(), kind=AccountKind.ASSET, name="card", currency="EUR", status=EntityStatusType.ACTIVE)
    employer = Account(id=uuid4(), kind=AccountKind.INCOME, name="Employer", status=EntityStatusType.ACTIVE)
    location = Location(id=uuid4(), name="No location", status=EntityStatusType.ACTIVE)
    classification = Classification(id=uuid4(), kind=ClassificationKind.EXPENSE_CATEGORY, is_default=True)

    # act
    matches = match_entities(
        rows=rows, accounts=[card, employer], locations=[location], classifications=[classification], decisions=[]
    )

    # assert
    groups = {(group.kind, group.name): group for group in matches.groups}
    money = groups[ImportEntityKind.MONEY_ACCOUNT, "Card"]
    assert (money.row_count, money.currency, money.candidate_ids) == (2, "EUR", [card.id])
    assert money.decisions[0].entity_id == card.id
    assert groups[ImportEntityKind.MONEY_ACCOUNT, None].decisions[0].entity_id == card.id
    assert groups[ImportEntityKind.INCOME_SOURCE, "Employer"].decisions[0].entity_id == employer.id
    assert groups[ImportEntityKind.LOCATION, None].decisions[0].entity_id == location.id
    category = groups[ImportEntityKind.CATEGORY, "Food"].decisions[0]
    assert category.action == ImportEntityAction.CREATE
    assert category.new_entity == ImportNewEntity(
        name="Food", classification_id=classification.id, category_purpose=CategoryPurpose.PERSONAL
    )
    assert matches.assignments[2, ImportColumn.TO] == matches.assignments[3, ImportColumn.TO]
    assert all(group.issue is None for group in matches.groups)


@pytest.mark.parametrize(
    ("name", "second_currency", "account_entries", "issue"),
    [
        ("Card", None, [("EUR", "ACTIVE"), ("EUR", "ACTIVE")], ImportMatchIssue.AMBIGUOUS),
        ("Card", None, [("USD", "ACTIVE"), ("EUR", "DELETED")], ImportMatchIssue.CURRENCY_MISMATCH),
        ("Card", None, [("EUR", "DELETED")], ImportMatchIssue.DELETED),
        ("Card", "USD", [("EUR", "ACTIVE")], ImportMatchIssue.CURRENCY_CONFLICT),
        (None, None, [], ImportMatchIssue.UNASSIGNED),
        (None, None, [("EUR", "ACTIVE"), ("EUR", "ACTIVE")], ImportMatchIssue.AMBIGUOUS),
    ],
)
def test_unresolved_money_groups_mark_the_rows(name, second_currency, account_entries, issue):
    # arrange
    accounts = [
        Account(id=uuid4(), name="Card", kind=AccountKind.ASSET, currency=currency, status=status)
        for currency, status in account_entries
    ]
    rows = [
        TransactionImportRow.model_construct(
            row_number=2,
            transaction_type=TransactionType.ADJUSTMENT,
            from_name=name,
            currency="EUR",
            errors=[],
        ),
        TransactionImportRow.model_construct(
            row_number=3,
            transaction_type=TransactionType.ADJUSTMENT,
            from_name=name,
            currency=second_currency or "EUR",
            errors=[],
        ),
    ]

    # act
    matches = match_entities(rows=rows, accounts=accounts, locations=[], classifications=[], decisions=[])

    # assert
    (group,) = matches.groups
    assert group.issue == issue
    assert group.decisions == []
    assert group.row_count == 2
    assert group.candidate_ids == ([account.id for account in accounts] if issue == ImportMatchIssue.AMBIGUOUS else [])
    assert [(row.errors[0].column, row.errors[0].code) for row in rows] == [(ImportColumn.FROM, issue)] * 2


def test_new_money_account_and_blank_location_proposals():
    # arrange
    classification = Classification(id=uuid4(), kind=ClassificationKind.MONEY_ACCOUNT, is_default=True)
    deleted = Location(id=uuid4(), name="No location", status=EntityStatusType.DELETED)
    rows = [
        TransactionImportRow.model_construct(
            row_number=2,
            transaction_type=TransactionType.EXPENSE,
            from_name="Card",
            to_name="Food",
            location_name=None,
            currency="EUR",
            errors=[],
        )
    ]

    # act
    matches = match_entities(
        rows=rows, accounts=[], locations=[deleted], classifications=[classification], decisions=[]
    )

    # assert
    groups = {group.kind: group for group in matches.groups}
    assert groups[ImportEntityKind.MONEY_ACCOUNT].decisions[0].new_entity == ImportNewEntity(
        name="Card", currency="EUR", classification_id=classification.id
    )
    assert groups[ImportEntityKind.LOCATION].decisions[0].new_entity == ImportNewEntity(name="No location")
    assert rows[0].errors == []


@pytest.mark.parametrize("row_numbers", [[], [2, 2], [7], None])
def test_invalid_or_overlapping_blank_account_selections_are_rejected(row_numbers):
    # arrange
    rows = [
        TransactionImportRow.model_construct(
            row_number=number,
            transaction_type=TransactionType.ADJUSTMENT,
            from_name=None,
            currency="EUR",
            errors=[],
        )
        for number in (2, 3)
    ]
    card = Account(id=uuid4(), kind=AccountKind.ASSET, name="Card", currency="EUR", status=EntityStatusType.ACTIVE)
    first = ImportEntityDecision(
        kind=ImportEntityKind.MONEY_ACCOUNT,
        name=None,
        currency="EUR",
        row_numbers=[2],
        action=ImportEntityAction.USE_EXISTING,
        entity_id=card.id,
    )

    # act / assert
    with pytest.raises(ImportDecisionsInvalid):
        match_entities(
            rows=rows,
            accounts=[card],
            locations=[],
            classifications=[],
            decisions=[first, first.model_copy(update={"row_numbers": row_numbers})],
            validate_decisions=True,
        )
