import pytest
from pydantic import ValidationError

from app.schemas.accounting.account import AccountCreateRequest, AccountKind, AccountUpdate


@pytest.mark.parametrize(
    "kind, currency",
    [
        (AccountKind.ASSET, "USD"),
        (AccountKind.INCOME, None),
        (AccountKind.EXPENSE, None),
    ],
)
def test_account_create_request_ok(kind: AccountKind, currency: str | None):
    # Act
    request: AccountCreateRequest = AccountCreateRequest(kind=kind, name="Account", currency=currency)

    # Assert
    assert request.kind == kind
    assert request.currency == currency


def test_account_create_request_equity():
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=AccountKind.EQUITY, name="Adjustments")

    assert "EQUITY accounts can not be created" in str(exc.value)


@pytest.mark.parametrize(
    "kind, currency",
    [
        (AccountKind.ASSET, None),
        (AccountKind.INCOME, "USD"),
    ],
)
def test_account_create_request_currency_mismatch(kind: AccountKind, currency: str | None):
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=kind, name="Account", currency=currency)

    assert "currency should be filled for ASSET accounts only" in str(exc.value)


@pytest.mark.parametrize("kind", [AccountKind.INCOME, AccountKind.EXPENSE])
def test_account_create_request_color_mismatch(kind: AccountKind):
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        AccountCreateRequest(kind=kind, name="Account", color="#2E8C7A")

    assert "color can be filled for ASSET accounts only" in str(exc.value)
