from datetime import date
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
