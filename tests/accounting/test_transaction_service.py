from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.category import category_crud
from app.crud.accounting.income_source import income_source_crud
from app.crud.accounting.location import location_crud
from app.crud.user.user import user_crud
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.category import Category as CategoryModel
from app.models.accounting.income_source import IncomeSource as IncomeSourceModel
from app.models.accounting.location import Location as LocationModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.category import CategoryCreate, CategoryType
from app.schemas.accounting.income_source import IncomeSourceCreate
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.transaction import (ExpenseRequest, IncomeRequest, Transaction, TransactionRequest,
                                                TransactionType, TransferRequest)
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting import transaction_service
from app.services.accounting.transaction_processor.base import TransactionProcessor


@pytest.mark.asyncio
async def test_get_transactions(db: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test 1',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    wrong_user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    account_create_data: dict = {'user_id': wrong_user_db.id,
                                 'name': 'Income EUR',
                                 'currency': CurrencyType.EUR,
                                 'account_type': AccountType.INCOME,
                                 'balance': Decimal('100'),
                                 'base_currency_rate': Decimal('0.9526')}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=wrong_user_db.id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)
    for i in range(1, 4):
        income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10 + i),
                                                          source_amount=Decimal('105') * i,
                                                          source_currency=CurrencyType.USD,
                                                          destination_amount=Decimal('100'),
                                                          destination_currency=CurrencyType.EUR,
                                                          to_account_id=account_db.id,
                                                          income_source_id=income_source_db.id,
                                                          income_period=date(2025, 1, 1))
        transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                                   user_id=wrong_user_db.id,
                                                                                   transaction_type=income_create_data.transaction_type)
        await transaction_processor.create(data=income_create_data)

    user_create_data: UserCreate = UserCreate(username='test 2',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Checking USD',
                                 'currency': CurrencyType.USD,
                                 'account_type': AccountType.CHECKING,
                                 'balance': Decimal('2000'),
                                 'base_currency_rate': Decimal('1')}
    account_checking_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    category_create_data: CategoryCreate = CategoryCreate(user_id=user_id,
                                                          name='Food',
                                                          type=CategoryType.GENERAL)
    category_db: CategoryModel = await category_crud.create(db=db, obj_in=category_create_data, commit=True)

    location_create_data: LocationCreate = LocationCreate(user_id=user_id,
                                                          name='Some shop')
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    for i in range(2):
        expense_create_data: ExpenseRequest = ExpenseRequest(transaction_date=date(2025, 2, 1),
                                                             source_amount=Decimal('100'),
                                                             source_currency=CurrencyType.USD,
                                                             destination_amount=Decimal('11100'),
                                                             destination_currency=CurrencyType.RSD,
                                                             from_account_id=account_checking_db.id,
                                                             category_id=category_db.id,
                                                             location_id=location_db.id)
        transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                                   user_id=user_id,
                                                                                   transaction_type=expense_create_data.transaction_type)
        transaction: Transaction = await transaction_processor.create(data=expense_create_data)
        if i == 1:
            await transaction_service.delete_transaction(db=db, transaction_id=transaction.id, user_id=user_id)

    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Income EUR',
                                 'currency': CurrencyType.EUR,
                                 'account_type': AccountType.INCOME,
                                 'balance': Decimal('100'),
                                 'base_currency_rate': Decimal('0.9526')}
    account_income_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 2),
                                                      source_amount=Decimal('1050'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1000'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_income_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 1))
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    await transaction_processor.create(data=income_create_data)

    transfer_create_data: TransferRequest = TransferRequest(transaction_date=date(2025, 2, 3),
                                                            source_amount=Decimal('100'),
                                                            source_currency=CurrencyType.EUR,
                                                            destination_currency=CurrencyType.USD,
                                                            destination_amount=Decimal('105'),
                                                            from_account_id=account_income_db.id,
                                                            to_account_id=account_checking_db.id,
                                                            comment='test')
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_db.id,
                                                                               transaction_type=transfer_create_data.transaction_type)
    await transaction_processor.create(data=transfer_create_data)
    await db.commit()
    await db.close()

    request_p1: TransactionRequest = TransactionRequest(page=1, size=2)
    request_p2: TransactionRequest = TransactionRequest(page=2, size=2)
    request_all: TransactionRequest = TransactionRequest(statuses=[])
    request_from_101: TransactionRequest = TransactionRequest(base_currency_amount_from=Decimal('101'))
    request_to_100: TransactionRequest = TransactionRequest(base_currency_amount_to=Decimal('100'))
    request_from_101_to_105: TransactionRequest = TransactionRequest(base_currency_amount_from=Decimal('101'),
                                                                     base_currency_amount_to=Decimal('105'))
    request_date_from: TransactionRequest = TransactionRequest(date_from=date(2025, 2, 2))
    request_date_to: TransactionRequest = TransactionRequest(date_to=date(2025, 2, 2))
    request_date_from_to: TransactionRequest = TransactionRequest(date_from=date(2025, 2, 3),
                                                                  date_to=date(2025, 2, 3))
    request_transaction_type: TransactionRequest = TransactionRequest(transaction_types=[TransactionType.TRANSFER])

    # Act
    transactions_p1: Page[Transaction] = await transaction_service.get_transactions(db=db, request=request_p1,
                                                                                    user_id=user_id)
    transactions_p2: Page[Transaction] = await transaction_service.get_transactions(db=db, request=request_p2,
                                                                                    user_id=user_id)
    transactions_all: Page[Transaction] = await transaction_service.get_transactions(db=db, request=request_all,
                                                                                     user_id=user_id)
    transactions_from_101: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                          request=request_from_101,
                                                                                          user_id=user_id)
    transactions_to_100: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                        request=request_to_100,
                                                                                        user_id=user_id)
    transactions_from_101_to_105: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                                 request=request_from_101_to_105,
                                                                                                 user_id=user_id)
    transactions_date_from: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                           request=request_date_from,
                                                                                           user_id=user_id)
    transactions_date_to: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                         request=request_date_to,
                                                                                         user_id=user_id)
    transactions_date_from_to: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                              request=request_date_from_to,
                                                                                              user_id=user_id)
    transactions_transaction_type: Page[Transaction] = await transaction_service.get_transactions(db=db,
                                                                                                  request=request_transaction_type,
                                                                                                  user_id=user_id)

    # Assert
    assert transactions_p1.total == 3
    assert len(transactions_p1.items) == 2
    assert transactions_p1.items[0].transaction_type == TransactionType.TRANSFER
    assert transactions_p1.items[1].transaction_type == TransactionType.INCOME

    assert transactions_p2.total == 3
    assert len(transactions_p2.items) == 1
    assert transactions_p2.items[0].transaction_type == TransactionType.EXPENSE

    assert transactions_all.total == 4
    assert len(transactions_all.items) == 4

    assert transactions_from_101.total == 2
    assert len(transactions_from_101.items) == 2
    for item in transactions_from_101.items:
        assert item.base_currency_amount >= Decimal('101')

    assert transactions_to_100.total == 1
    assert len(transactions_to_100.items) == 1
    assert transactions_to_100.items[0].base_currency_amount <= Decimal('100')

    assert transactions_from_101_to_105.total == 1
    assert len(transactions_from_101_to_105.items) == 1
    assert transactions_from_101_to_105.items[0].base_currency_amount >= Decimal('101')
    assert transactions_from_101_to_105.items[0].base_currency_amount <= Decimal('105')

    assert transactions_date_from.total == 2
    assert len(transactions_date_from.items) == 2
    for item in transactions_date_from.items:
        assert item.transaction_date >= date(2025, 2, 2)

    assert transactions_date_to.total == 2
    assert len(transactions_date_to.items) == 2
    for item in transactions_date_to.items:
        assert item.transaction_date <= date(2025, 2, 2)

    assert transactions_date_from_to.total == 1
    assert len(transactions_date_from_to.items) == 1
    assert transactions_date_from_to.items[0].transaction_date >= date(2025, 2, 3)
    assert transactions_date_from_to.items[0].transaction_date <= date(2025, 2, 3)

    assert transactions_transaction_type.total == 1
    assert len(transactions_transaction_type.items) == 1
    assert transactions_transaction_type.items[0].transaction_type == TransactionType.TRANSFER
