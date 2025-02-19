from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.transaction.transaction import (Order, OrderDirectionType, OrderFieldType, TransactionRequest,
                                                 TransactionType)


def test_hash_equality():
    uid = uuid4()
    req1 = TransactionRequest(
        page=2,
        size=30,
        orders=[Order(field=OrderFieldType.TRANSACTION_DATE, ordering=OrderDirectionType.DESC)],
        amount_from=Decimal("100.00"),
        amount_to=Decimal("200.00"),
        currencies=[CurrencyType.USD],
        date_from=datetime(2025, 1, 1),
        date_to=datetime(2025, 1, 31),
        category_ids=[uid],
        location_ids=[uid],
        transaction_types=[TransactionType.TRANSFER],
        statuses=[EntityStatusType.ACTIVE]
    )
    req2 = TransactionRequest(
        page=2,
        size=30,
        orders=[Order(field=OrderFieldType.TRANSACTION_DATE, ordering=OrderDirectionType.DESC)],
        amount_from=Decimal("100.00"),
        amount_to=Decimal("200.00"),
        currencies=[CurrencyType.USD],
        date_from=datetime(2025, 1, 1),
        date_to=datetime(2025, 1, 31),
        category_ids=[uid],
        location_ids=[uid],
        transaction_types=[TransactionType.TRANSFER],
        statuses=[EntityStatusType.ACTIVE]
    )
    assert hash(req1) == hash(req2)

def test_hash_inequality():
    req1 = TransactionRequest(page=2, size=30)
    req2 = TransactionRequest(page=3, size=30)
    assert hash(req1) != hash(req2)

def test_hash_after_mutation():
    req = TransactionRequest(page=2, size=30)
    initial_hash = hash(req)
    # Модифицируем список orders
    req.orders.append(Order(field=OrderFieldType.CREATED_AT, ordering=OrderDirectionType.DESC))
    new_hash = hash(req)
    assert initial_hash != new_hash
