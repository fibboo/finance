from datetime import date, datetime, timedelta, UTC
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
import time_machine
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountKind, CategoryType
from app.schemas.accounting.currency import Currency
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.dictionary import DictionaryItem
from app.schemas.error_response import ErrorCodeType
from app.services.accounting.currency_service import get_currencies, get_currency


async def test_get_currency(db: AsyncSession):
    # Act
    currency: Currency = await get_currency(db=db, code="RSD")

    # Assert
    assert currency == Currency(code="RSD", name="Serbian Dinar")


async def test_get_currency_unknown_code(db: AsyncSession):
    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await get_currency(db=db, code="XXX")

    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
    assert exc.value.log_message == "Currency not found by {'code': 'XXX'}"


@time_machine.travel(datetime(2026, 6, 15, 12, tzinfo=UTC), tick=False)
async def test_get_currencies_recent_use_order(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    other_user_id: UUID = uuid4()
    today: date = date(2026, 6, 15)
    wallets_db: dict[UUID, AccountModel] = {}
    categories_db: dict[UUID, AccountModel] = {}
    locations_db: dict[UUID, LocationModel] = {}
    for owner_id in [user_id, other_user_id]:
        wallets_db[owner_id] = await account_crud.create(
            db=db,
            obj_in={"user_id": owner_id, "kind": AccountKind.ASSET, "name": "Wallet", "currency": "USD"},
            commit=True,
        )
        categories_db[owner_id] = await account_crud.create(
            db=db,
            obj_in={
                "user_id": owner_id,
                "kind": AccountKind.EXPENSE,
                "name": "Groceries",
                "category_type": CategoryType.VARIABLE,
            },
            commit=True,
        )
        locations_db[owner_id] = await location_crud.create(
            db=db, obj_in=LocationCreate(user_id=owner_id, name="Some shop"), commit=True
        )

    # USD and EUR are used three times today in expenses paid in EUR from USD, one posting each; RUB three times
    # dated tomorrow (still a local today east of UTC), two postings each, which are no extra uses; GEL twice within
    # the 90 days up to today and RSD once; TRY three times each two days ahead, 90 days ago, in deleted expenses and
    # in the expenses of another user, so that any of them counted would put TRY ahead of RUB
    expenses: list[tuple[UUID, str, str, date, EntityStatusType]] = [
        (user_id, "USD", "EUR", today, EntityStatusType.ACTIVE),
        (user_id, "USD", "EUR", today, EntityStatusType.ACTIVE),
        (user_id, "USD", "EUR", today, EntityStatusType.ACTIVE),
        (user_id, "RUB", "RUB", today + timedelta(days=1), EntityStatusType.ACTIVE),
        (user_id, "RUB", "RUB", today + timedelta(days=1), EntityStatusType.ACTIVE),
        (user_id, "RUB", "RUB", today + timedelta(days=1), EntityStatusType.ACTIVE),
        (user_id, "GEL", "GEL", today - timedelta(days=1), EntityStatusType.ACTIVE),
        (user_id, "GEL", "GEL", today - timedelta(days=89), EntityStatusType.ACTIVE),
        (user_id, "RSD", "RSD", today, EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today + timedelta(days=2), EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today + timedelta(days=2), EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today + timedelta(days=2), EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today - timedelta(days=90), EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today - timedelta(days=90), EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today - timedelta(days=90), EntityStatusType.ACTIVE),
        (user_id, "TRY", "TRY", today, EntityStatusType.DELETED),
        (user_id, "TRY", "TRY", today, EntityStatusType.DELETED),
        (user_id, "TRY", "TRY", today, EntityStatusType.DELETED),
        (other_user_id, "TRY", "TRY", today, EntityStatusType.ACTIVE),
        (other_user_id, "TRY", "TRY", today, EntityStatusType.ACTIVE),
        (other_user_id, "TRY", "TRY", today, EntityStatusType.ACTIVE),
    ]
    for owner_id, source_currency, destination_currency, transaction_date, transaction_status in expenses:
        expense_db: TransactionModel = await transaction_crud.create_with_postings(
            db=db,
            obj_in=TransactionCreate(
                user_id=owner_id,
                transaction_type=TransactionType.EXPENSE,
                transaction_date=transaction_date,
                base_currency_amount=Decimal("10"),
                location_id=locations_db[owner_id].id,
            ),
            postings=[
                PostingCreate(
                    account_id=wallets_db[owner_id].id,
                    amount=Decimal("-10"),
                    currency=source_currency,
                    base_amount=Decimal("-10"),
                ),
                PostingCreate(
                    account_id=categories_db[owner_id].id,
                    amount=Decimal("10"),
                    currency=destination_currency,
                    base_amount=Decimal("10"),
                ),
            ],
        )
        await transaction_crud.update_orm(db=db, obj_in={"status": transaction_status}, id=expense_db.id)
    await db.commit()

    # Act
    currencies: list[DictionaryItem] = await get_currencies(db=db, user_id=user_id)

    # Assert
    assert currencies == [
        DictionaryItem(key="USD", label="US Dollar"),
        DictionaryItem(key="EUR", label="Euro"),
        DictionaryItem(key="RUB", label="Russian Ruble"),
        DictionaryItem(key="GEL", label="Georgian Lari"),
        DictionaryItem(key="RSD", label="Serbian Dinar"),
        DictionaryItem(key="TRY", label="Turkish Lira"),
    ]


async def test_get_currencies_without_transactions(db: AsyncSession):
    # Act
    currencies: list[DictionaryItem] = await get_currencies(db=db, user_id=uuid4())

    # Assert
    assert [currency.key for currency in currencies] == ["USD", "EUR", "RSD", "GEL", "TRY", "RUB"]
