from copy import copy
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.income_source import income_source_crud
from app.crud.user.user import user_crud
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.income_source import IncomeSource as IncomeSourceModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountCreate, AccountType
from app.schemas.accounting.income_source import IncomeSourceCreate
from app.schemas.accounting.transaction import IncomeRequest, Transaction, TransactionType
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_processor.base import TransactionProcessor


@pytest.mark.asyncio
async def test_create_income_base_currency_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_create_data: AccountCreate = AccountCreate(user_id=user_db.id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_db.id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db_fixture,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.USD,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id)

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=income_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == income_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.source_amount == Decimal('1')
    assert transaction.source_currency == CurrencyType.USD
    assert transaction.destination_amount == Decimal('1')
    assert transaction.destination_currency == CurrencyType.USD
    assert transaction.base_currency_amount == Decimal('1')

    assert transaction.from_account_id is None
    assert transaction.from_account is None
    assert transaction.to_account_id == account_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('1') != account_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('1') != base_currency_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id == income_source_db.id
    assert transaction.income_source is not None


@pytest.mark.asyncio
async def test_create_income_other_currency_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_create_data: AccountCreate = AccountCreate(user_id=user_db.id,
                                                       name='Income EUR',
                                                       currency=CurrencyType.EUR,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_db.id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db_fixture,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1050'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1000'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id)

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=income_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == income_create_data.transaction_date
    assert transaction.comment is None
    assert transaction.source_amount == Decimal('1050')
    assert transaction.source_currency == CurrencyType.USD
    assert transaction.destination_amount == Decimal('1000')
    assert transaction.destination_currency == CurrencyType.EUR
    assert transaction.base_currency_amount == Decimal('1050')

    assert transaction.from_account_id is None
    assert transaction.from_account is None
    assert transaction.to_account_id == account_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('1000') != account_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('0.9524') != base_currency_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id == income_source_db.id
    assert transaction.income_source is not None


@pytest.mark.asyncio
async def test_create_income_other_currency_2_transactions_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_create_data: AccountCreate = AccountCreate(user_id=user_db.id,
                                                       name='Income EUR',
                                                       currency=CurrencyType.EUR,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_db.id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db_fixture,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data_1: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1050'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1000'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id)
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=income_create_data_1)
    transaction_1: Transaction = await transaction_processor.create()
    account_balance_before: Decimal = copy(transaction_1.to_account.balance)
    base_currency_rate_before: Decimal = copy(transaction_1.to_account.base_currency_rate)
    await db_fixture.commit()

    income_create_data_2: IncomeRequest = IncomeRequest(transaction_date=date(2025, 3, 10),
                                                        source_amount=Decimal('1100'),
                                                        source_currency=CurrencyType.USD,
                                                        destination_amount=Decimal('1000'),
                                                        destination_currency=CurrencyType.EUR,
                                                        to_account_id=account_db.id,
                                                        income_source_id=income_source_db.id)

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=income_create_data_2)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.INCOME
    assert transaction.transaction_date == income_create_data_2.transaction_date
    assert transaction.comment is None
    assert transaction.source_amount == Decimal('1100')
    assert transaction.source_currency == CurrencyType.USD
    assert transaction.destination_amount == Decimal('1000')
    assert transaction.destination_currency == CurrencyType.EUR
    assert transaction.base_currency_amount == Decimal('1100')

    assert transaction.from_account_id is None
    assert transaction.from_account is None
    assert transaction.to_account_id == account_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('2000') != account_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('0.9302') != base_currency_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id == income_source_db.id
    assert transaction.income_source is not None
