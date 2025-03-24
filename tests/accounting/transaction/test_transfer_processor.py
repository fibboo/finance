from copy import copy
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.user.user import user_crud
from app.models.accounting.account import Account as AccountModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountCreate, AccountType
from app.schemas.accounting.transaction import Transaction, TransactionType, TransferRequest
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.transaction_processor.base import TransactionProcessor


@pytest.mark.asyncio
async def test_create_transfer_base_to_base_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {'user_id': user_db.id,
                                      'name': 'Income USD',
                                      'currency': CurrencyType.USD,
                                      'account_type': AccountType.INCOME,
                                      'base_currency_rate': Decimal('1')}
    account_from_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_from_create_data,
                                                              commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id,
                                                          name='Checking USD',
                                                          currency=CurrencyType.USD,
                                                          account_type=AccountType.CHECKING)
    account_to_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(transaction_date=date(2025, 2, 10),
                                                            source_amount=Decimal('1'),
                                                            source_currency=CurrencyType.USD,
                                                            destination_currency=CurrencyType.USD,
                                                            from_account_id=account_from_db.id,
                                                            to_account_id=account_to_db.id,
                                                            comment='test')

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=transfer_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal('1')
    assert transaction.source_currency == CurrencyType.USD
    assert transaction.destination_amount == Decimal('1')
    assert transaction.destination_currency == CurrencyType.USD
    assert transaction.base_currency_amount == Decimal('1')

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal('-1') != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('1') != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('1') != base_currency_to_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None


@pytest.mark.asyncio
async def test_create_transfer_base_to_other_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {'user_id': user_db.id,
                                      'name': 'Income USD',
                                      'currency': CurrencyType.USD,
                                      'account_type': AccountType.INCOME,
                                      'base_currency_rate': Decimal('1')}
    account_from_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_from_create_data,
                                                              commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id,
                                                          name='Checking EUR',
                                                          currency=CurrencyType.EUR,
                                                          account_type=AccountType.CHECKING)
    account_to_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(transaction_date=date(2025, 2, 10),
                                                            source_amount=Decimal('105'),
                                                            source_currency=CurrencyType.USD,
                                                            destination_currency=CurrencyType.EUR,
                                                            destination_amount=Decimal('100'),
                                                            from_account_id=account_from_db.id,
                                                            to_account_id=account_to_db.id,
                                                            comment='test')

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=transfer_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal('105')
    assert transaction.source_currency == CurrencyType.USD
    assert transaction.destination_amount == Decimal('100')
    assert transaction.destination_currency == CurrencyType.EUR
    assert transaction.base_currency_amount == Decimal('105')

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal('-105') != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('100') != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('0.9524') != base_currency_to_rate_before
    assert transaction.to_account.currency == transfer_create_data.destination_currency

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None


@pytest.mark.asyncio
async def test_create_transfer_other_to_base_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {'user_id': user_db.id,
                                      'name': 'Income EUR',
                                      'currency': CurrencyType.EUR,
                                      'account_type': AccountType.INCOME,
                                      'base_currency_rate': Decimal('0.9524')}
    account_from_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_from_create_data,
                                                              commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: AccountCreate = AccountCreate(user_id=user_db.id,
                                                          name='Checking USD',
                                                          currency=CurrencyType.USD,
                                                          account_type=AccountType.CHECKING)
    account_to_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(transaction_date=date(2025, 2, 10),
                                                            source_amount=Decimal('100'),
                                                            source_currency=CurrencyType.EUR,
                                                            destination_currency=CurrencyType.USD,
                                                            from_account_id=account_from_db.id,
                                                            to_account_id=account_to_db.id,
                                                            comment='test')

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=transfer_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal('100')
    assert transaction.source_currency == CurrencyType.EUR
    assert transaction.destination_amount == Decimal('105')
    assert transaction.destination_currency == CurrencyType.USD
    assert transaction.base_currency_amount == Decimal('105')

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal('-100') != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('105') != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('1') != base_currency_to_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None


@pytest.mark.asyncio
async def test_create_transfer_other_to_other_ok(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)

    account_from_create_data: dict = {'user_id': user_db.id,
                                      'name': 'Income EUR',
                                      'currency': CurrencyType.EUR,
                                      'account_type': AccountType.INCOME,
                                      'base_currency_rate': Decimal('0.9524')}
    account_from_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_from_create_data,
                                                              commit=True)
    account_from_balance_before: Decimal = copy(account_from_db.balance)
    base_currency_from_rate_before: Decimal = copy(account_from_db.base_currency_rate)

    account_to_create_data: dict = {'user_id': user_db.id,
                                    'name': 'Expense RSD',
                                    'currency': CurrencyType.RSD,
                                    'account_type': AccountType.CHECKING,
                                    'balance': Decimal('11100'),
                                    'base_currency_rate': Decimal('111')}
    account_to_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_to_create_data, commit=True)
    account_to_balance_before: Decimal = copy(account_to_db.balance)
    base_currency_to_rate_before: Decimal = copy(account_to_db.base_currency_rate)

    transfer_create_data: TransferRequest = TransferRequest(transaction_date=date(2025, 2, 10),
                                                            source_amount=Decimal('100'),
                                                            source_currency=CurrencyType.EUR,
                                                            destination_currency=CurrencyType.RSD,
                                                            destination_amount=Decimal('11700'),
                                                            from_account_id=account_from_db.id,
                                                            to_account_id=account_to_db.id,
                                                            comment='test')

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_db.id,
                                                                               data=transfer_create_data)
    transaction: Transaction = await transaction_processor.create()
    await db_fixture.commit()

    # Assert
    assert transaction.transaction_type == TransactionType.TRANSFER
    assert transaction.transaction_date == transfer_create_data.transaction_date
    assert transaction.comment == transfer_create_data.comment
    assert transaction.source_amount == Decimal('100')
    assert transaction.source_currency == CurrencyType.EUR
    assert transaction.destination_amount == Decimal('11700')
    assert transaction.destination_currency == CurrencyType.RSD
    assert transaction.base_currency_amount == Decimal('105')

    assert transaction.from_account_id == account_from_db.id
    assert transaction.from_account is not None
    assert transaction.from_account.balance == Decimal('-100') != account_from_balance_before
    assert transaction.from_account.base_currency_rate == base_currency_from_rate_before
    assert transaction.from_account.currency == transfer_create_data.source_currency

    assert transaction.to_account_id == account_to_db.id
    assert transaction.to_account is not None
    assert transaction.to_account.balance == Decimal('22800') != account_to_balance_before
    assert transaction.to_account.base_currency_rate == Decimal('111.2195') != base_currency_to_rate_before

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_source_id is None
    assert transaction.income_source is None
