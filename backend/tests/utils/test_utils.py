from datetime import datetime
from decimal import Decimal

import pytest

from app.schemas.accounting.transaction import (
    Order,
    OrderDirectionType,
    OrderFieldType,
    TransactionRequest,
    TransactionType,
)
from app.schemas.base import EntityStatusType
from app.utils import utils


def test_hash_equality():
    req1 = TransactionRequest(
        page=2,
        size=30,
        orders=[Order(field=OrderFieldType.TRANSACTION_DATE, ordering=OrderDirectionType.DESC)],
        base_currency_amount_from=Decimal("100.00"),
        base_currency_amount_to=Decimal("200.00"),
        date_from=datetime(2025, 1, 1),
        date_to=datetime(2025, 1, 31),
        transaction_types=[TransactionType.TRANSFER],
        statuses=[EntityStatusType.ACTIVE],
    )
    req2 = TransactionRequest(
        page=2,
        size=30,
        orders=[Order(field=OrderFieldType.TRANSACTION_DATE, ordering=OrderDirectionType.DESC)],
        base_currency_amount_from=Decimal("100.00"),
        base_currency_amount_to=Decimal("200.00"),
        date_from=datetime(2025, 1, 1),
        date_to=datetime(2025, 1, 31),
        transaction_types=[TransactionType.TRANSFER],
        statuses=[EntityStatusType.ACTIVE],
    )
    assert hash(req1) == hash(req2)


def test_hash_inequality():
    req1 = TransactionRequest(page=2, size=30)
    req2 = TransactionRequest(page=3, size=30)
    assert hash(req1) != hash(req2)


def test_hash_after_mutation():
    req = TransactionRequest(page=2, size=30)
    initial_hash = hash(req)
    # Modify the orders list
    req.orders.append(Order(field=OrderFieldType.CREATED_AT, ordering=OrderDirectionType.DESC))
    new_hash = hash(req)
    assert initial_hash != new_hash


def test_hash_secret():
    # Act
    secret_hash: str = utils.hash_secret(secret="one_time_code")

    # Assert
    assert secret_hash == "03b411ef0f044a8472f1b7de95e53f992c9bf7131f6c15cc7a29c83f2a09f91c"


@pytest.mark.parametrize(
    "balance, base_currency_rate, expected_base_currency_balance",
    [
        (Decimal("14200.00"), Decimal("2.68"), "5298.51"),
        (Decimal("100"), Decimal("1"), "100.00"),
        (Decimal("-50.00"), Decimal("0.5"), "-100.00"),
        (Decimal("0"), Decimal("0.92"), "0.00"),
        (Decimal("250.00"), Decimal("0"), "0.00"),
    ],
    ids=["other_currency", "base_currency", "negative_balance", "empty_account", "no_rate"],
)
def test_get_base_currency_balance(balance: Decimal, base_currency_rate: Decimal, expected_base_currency_balance: str):
    # Act
    base_currency_balance: Decimal = utils.get_base_currency_balance(
        balance=balance, base_currency_rate=base_currency_rate
    )

    # Assert
    assert str(base_currency_balance) == expected_base_currency_balance
