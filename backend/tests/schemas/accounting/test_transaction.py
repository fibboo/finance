from datetime import date, datetime, timedelta, UTC
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.schemas.accounting.transaction import TransactionRequest, TransferRequest


def test_transfer_request_same_account():
    # Arrange
    account_id: UUID = uuid4()

    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        TransferRequest(
            transaction_date=date(2025, 2, 10),
            source_amount=Decimal("100"),
            source_currency="USD",
            destination_currency="USD",
            from_account_id=account_id,
            to_account_id=account_id,
        )

    assert "from_account_id and to_account_id should be different" in str(exc.value)


def test_transaction_request_date_from_after_date_to():
    # Act / Assert
    with pytest.raises(ValidationError) as exc:
        TransactionRequest(date_from=date(2025, 6, 2), date_to=date(2025, 6, 1))

    assert "date_from should not be later than date_to" in str(exc.value)


def test_transaction_request_date_from_defaults_before_date_to():
    # Act
    request: TransactionRequest = TransactionRequest(date_to=date(2025, 6, 30))

    # Assert
    assert request.date_from == date(2025, 4, 1)
    assert request.date_to == date(2025, 6, 30)


def test_transaction_request_date_to_defaults_to_utc_today():
    # Arrange
    today: date = datetime.now(UTC).date()

    # Act
    request: TransactionRequest = TransactionRequest()

    # Assert
    assert request.date_to == today
    assert request.date_from == today - timedelta(days=90)
