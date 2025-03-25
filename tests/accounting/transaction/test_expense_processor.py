from copy import copy
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.accounting.category import category_crud
from app.crud.accounting.location import location_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import (AccountTypeMismatchException, CurrencyMismatchException,
                                          NoAccountBaseCurrencyRate)
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.category import Category as CategoryModel
from app.models.accounting.location import Location as LocationModel
from app.schemas.accounting.account import AccountCreate, AccountType
from app.schemas.accounting.category import CategoryCreate, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import ExpenseRequest, Transaction, TransactionType
from app.schemas.base import CurrencyType
from app.schemas.error_response import ErrorCodeType
from app.services.accounting.transaction_processor.base import TransactionProcessor


@pytest.mark.asyncio
async def test_create_expense_ok(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Checking USD',
                                 'currency': CurrencyType.USD,
                                 'account_type': AccountType.CHECKING,
                                 'base_currency_rate': Decimal('1')}
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    category_create_data: CategoryCreate = CategoryCreate(user_id=user_id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
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
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_id,
                                                                               data=expense_create_data)

    # Act
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


@pytest.mark.asyncio
async def test_create_expense_account_not_found(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    category_create_data: CategoryCreate = CategoryCreate(user_id=user_id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
                                                          name='Some shop')
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_data, commit=True)

    from_account_id: UUID = uuid4()
    expense_create_data: ExpenseRequest = ExpenseRequest(transaction_date=date(2025, 2, 10),
                                                         source_amount=Decimal('1'),
                                                         source_currency=CurrencyType.USD,
                                                         destination_amount=Decimal('111'),
                                                         destination_currency=CurrencyType.RSD,
                                                         from_account_id=from_account_id,
                                                         category_id=category_db.id,
                                                         location_id=location_db.id)
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_id,
                                                                               data=expense_create_data)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.title == 'Entity not found'
    assert exc.value.message == f"Account not found by {{'id': UUID('{from_account_id}')}}"
    assert exc.value.log_message == exc.value.message
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_create_expense_no_base_rate(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)

    category_create_data: CategoryCreate = CategoryCreate(user_id=user_id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
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
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_id,
                                                                               data=expense_create_data)

    # Act
    with pytest.raises(NoAccountBaseCurrencyRate) as exc:
        await transaction_processor.create()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.title == 'Accounts has no base currency rate'
    assert exc.value.message == f'Account {account_db.id} has no base currency rate. Try to make first deposit'
    assert exc.value.log_message == exc.value.message
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.NO_ACCOUNT_BASE_CURRENCY_RATE


@pytest.mark.asyncio
async def test_create_expense_currency_mismatch(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Checking USD',
                                 'currency': CurrencyType.USD,
                                 'account_type': AccountType.CHECKING,
                                 'base_currency_rate': Decimal('1')}
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)

    category_create_data: CategoryCreate = CategoryCreate(user_id=user_id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
                                                          name='Some shop')
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_data, commit=True)

    expense_create_data: ExpenseRequest = ExpenseRequest(transaction_date=date(2025, 2, 10),
                                                         source_amount=Decimal('1'),
                                                         source_currency=CurrencyType.RSD,
                                                         destination_amount=Decimal('111'),
                                                         destination_currency=CurrencyType.RSD,
                                                         from_account_id=account_db.id,
                                                         category_id=category_db.id,
                                                         location_id=location_db.id)
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_id,
                                                                               data=expense_create_data)

    # Act
    with pytest.raises(CurrencyMismatchException) as exc:
        await transaction_processor.create()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.title == 'Account and transaction currency mismatch'
    assert exc.value.message == (f'Transaction currency {expense_create_data.source_currency} differs '
                                 f'from account `{account_db.id}` currency {account_db.currency}')
    assert exc.value.log_message == exc.value.message
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.CURRENCY_MISMATCH


@pytest.mark.asyncio
async def test_create_expense_account_type_mismatch(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Checking USD',
                                 'currency': CurrencyType.USD,
                                 'account_type': AccountType.INCOME,
                                 'base_currency_rate': Decimal('1')}
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)

    category_create_data: CategoryCreate = CategoryCreate(user_id=user_id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
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
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_id,
                                                                               data=expense_create_data)

    # Act
    with pytest.raises(AccountTypeMismatchException) as exc:
        await transaction_processor.create()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.title == 'Account and transaction type mismatch'
    assert exc.value.message == (f'Transaction type {TransactionType.EXPENSE} is not allowed for '
                                 f'account `{account_db.id}` with type {account_db.account_type}')
    assert exc.value.log_message == exc.value.message
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_TYPE_MISMATCH


@pytest.mark.asyncio
async def test_create_expense_integrity_error(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Checking USD',
                                 'currency': CurrencyType.USD,
                                 'account_type': AccountType.CHECKING,
                                 'base_currency_rate': Decimal('1')}
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=account_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
                                                          name='Some shop')
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_data, commit=True)

    category_id: UUID = uuid4()
    expense_create_data: ExpenseRequest = ExpenseRequest(transaction_date=date(2025, 2, 10),
                                                         source_amount=Decimal('1'),
                                                         source_currency=CurrencyType.USD,
                                                         destination_amount=Decimal('111'),
                                                         destination_currency=CurrencyType.RSD,
                                                         from_account_id=account_db.id,
                                                         category_id=category_id,
                                                         location_id=location_db.id)
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_fixture,
                                                                               user_id=user_id,
                                                                               data=expense_create_data)

    # Act
    with pytest.raises(IntegrityException) as exc:
        await transaction_processor.create()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.title == 'Entity integrity error'
    assert exc.value.message == (f'Transaction integrity error: DETAIL:  Key (category_id)='
                                 f'({category_id}) is not present in table "categories".')
    assert exc.value.log_message == exc.value.message
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR
