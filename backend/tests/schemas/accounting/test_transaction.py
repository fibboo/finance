from datetime import date, datetime, UTC
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.schemas.accounting.transaction import MovementRequest, TransactionRequest


def test_movement_request_same_account():
    # Arrange
    account_id: UUID = uuid4()

    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        MovementRequest(
            transaction_date=date(2025, 2, 10),
            source_amount=Decimal("100"),
            source_currency="USD",
            destination_currency="USD",
            from_account_id=account_id,
            to_account_id=account_id,
        )

    assert "from_account_id and to_account_id should be different" in str(exc.value)


def test_movement_request_income_period_first_of_month():
    # Act
    request: MovementRequest = MovementRequest(
        transaction_date=date(2025, 2, 10),
        source_amount=Decimal("100"),
        source_currency="USD",
        destination_amount=Decimal("100"),
        destination_currency="USD",
        from_account_id=uuid4(),
        to_account_id=uuid4(),
        income_period=date(2025, 2, 17),
    )

    # Assert
    assert request.income_period == date(2025, 2, 1)


def test_transaction_request_date_from_after_date_to():
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        TransactionRequest(date_from=date(2025, 6, 2), date_to=date(2025, 6, 1))

    assert "date_from should not be later than date_to" in str(exc.value)


def test_transaction_request_date_from_stays_empty():
    # Act
    request: TransactionRequest = TransactionRequest(date_to=date(2025, 6, 30))

    # Assert
    assert request.date_from is None
    assert request.date_to == date(2025, 6, 30)


def test_transaction_request_date_to_defaults_to_utc_today():
    # Arrange
    today: date = datetime.now(UTC).date()

    # Act
    request: TransactionRequest = TransactionRequest()

    # Assert
    assert request.date_to == today
    assert request.date_from is None
