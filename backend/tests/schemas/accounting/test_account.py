import pytest
from pydantic import ValidationError

from app.schemas.accounting.account import AccountCreateRequest, AccountKind, AccountUpdate, CategoryType


@pytest.mark.parametrize(
    "kind, currency, category_type",
    [
        (AccountKind.ASSET, "USD", None),
        (AccountKind.LIABILITY, "EUR", None),
        (AccountKind.INCOME, None, None),
        (AccountKind.EXPENSE, None, CategoryType.FIXED),
    ],
)
def test_account_create_request_ok(kind: AccountKind, currency: str | None, category_type: CategoryType | None):
    # Act
    request: AccountCreateRequest = AccountCreateRequest(
        kind=kind, name="Account", currency=currency, category_type=category_type
    )

    # Assert
    assert request.kind == kind
    assert request.currency == currency
    assert request.category_type == category_type


def test_account_create_request_equity():
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=AccountKind.EQUITY, name="Adjustments")

    assert "EQUITY accounts can not be created" in str(exc.value)


@pytest.mark.parametrize(
    "kind, currency",
    [
        (AccountKind.ASSET, None),
        (AccountKind.LIABILITY, None),
        (AccountKind.INCOME, "USD"),
    ],
)
def test_account_create_request_currency_mismatch(kind: AccountKind, currency: str | None):
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=kind, name="Account", currency=currency)

    assert "currency should be filled for ASSET and LIABILITY accounts only" in str(exc.value)


@pytest.mark.parametrize(
    "kind, currency, category_type",
    [
        (AccountKind.EXPENSE, None, None),
        (AccountKind.ASSET, "USD", CategoryType.VARIABLE),
        (AccountKind.INCOME, None, CategoryType.VARIABLE),
    ],
)
def test_account_create_request_category_type_mismatch(
    kind: AccountKind, currency: str | None, category_type: CategoryType | None
):
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=kind, name="Account", currency=currency, category_type=category_type)

    assert "category_type should be filled for EXPENSE accounts only" in str(exc.value)


@pytest.mark.parametrize("kind, category_type", [(AccountKind.INCOME, None), (AccountKind.EXPENSE, CategoryType.FIXED)])
def test_account_create_request_color_mismatch(kind: AccountKind, category_type: CategoryType | None):
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=kind, name="Account", category_type=category_type, color="#2E8C7A")

    assert "color can be filled for ASSET and LIABILITY accounts only" in str(exc.value)


def test_account_update_null_category_type():
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountUpdate(name="Groceries", category_type=None)

    assert "category_type can not be null" in str(exc.value)
