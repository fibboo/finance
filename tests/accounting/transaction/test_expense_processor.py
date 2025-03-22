from copy import copy
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.category import category_crud
from app.crud.accounting.location import location_crud
from app.crud.user.user import user_crud
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.category import Category as CategoryModel
from app.models.accounting.location import Location as LocationModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.category import CategoryCreate, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import ExpenseRequest, Transaction, TransactionType
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_processor.base import TransactionProcessor


@pytest.mark.asyncio
async def test_create_expense_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_create_data: dict = {'user_id': user_db.id,
                                 'name': 'Checking USD',
                                 'currency': CurrencyType.USD,
                                 'account_type': AccountType.CHECKING,
                                 'base_currency_rate': Decimal('1')}
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    category_create_data: CategoryCreate = CategoryCreate(user_id=user_db.id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_db.id,
                                                          name='Some shop')
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_data, commit=True)

    expense_create_data: ExpenseRequest = ExpenseRequest(transaction_date=date(2025, 2, 10),
                                                         source_amount=Decimal('1'),
                                                         source_currency=CurrencyType.USD,
                                                         destination_amount=Decimal('111'),
                                                         destination_currency=CurrencyType.RSD,
                                                         from_account_id=account_db.id,
                                                         category_id=category_db.id,
                                                         location_id=location_db.id)

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=expense_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.EXPENSE
    assert transaction.transaction_date == expense_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.source_amount == Decimal('1')
    assert transaction.source_currency == CurrencyType.USD
    assert transaction.destination_amount == Decimal('111')
    assert transaction.destination_currency == CurrencyType.RSD
    assert transaction.base_currency_amount == Decimal('1')

    assert transaction.from_account_id == account_db.id
    assert transaction.from_account.balance == Decimal('-1') != account_balance_before
    assert transaction.from_account.base_currency_rate == Decimal('1') == base_currency_rate_before
    assert transaction.to_account_id is None
    assert transaction.to_account is None

    assert transaction.category_id == category_db.id
    assert transaction.category is not None
    assert transaction.location_id == location_db.id
    assert transaction.location is not None

    assert transaction.income_source_id is None
    assert transaction.income_source is None
