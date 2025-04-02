from copy import copy
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.account import account_crud
from app.crud.accounting.income_source import income_source_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import AccountTypeMismatchException, CurrencyMismatchException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.income_source import IncomeSource as IncomeSourceModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountCreate, AccountType
from app.schemas.accounting.income_source import IncomeSourceCreate
from app.schemas.accounting.transaction import IncomeRequest, Transaction, TransactionType
from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting import transaction_service
from app.services.accounting.transaction_processor.base import TransactionProcessor


@pytest.mark.asyncio
async def test_create_income_base_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.USD,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 18))
    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

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
    assert transaction.to_account.currency == income_create_data.destination_currency

    assert transaction.category_id is None
    assert transaction.category is None
    assert transaction.location_id is None
    assert transaction.location is None

    assert transaction.income_period == income_create_data.income_period.replace(day=1)
    assert transaction.income_source_id == income_source_db.id
    assert transaction.income_source is not None

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


@pytest.mark.asyncio
async def test_create_income_other_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income EUR',
                                                       currency=CurrencyType.EUR,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1050'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1000'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 1))

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    transaction: Transaction = await transaction_processor.create(data=income_create_data)
    await db_transaction.commit()

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

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 1


@pytest.mark.asyncio
async def test_create_income_other_currency_2_transactions_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income EUR',
                                                       currency=CurrencyType.EUR,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data_1: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                        source_amount=Decimal('1050'),
                                                        source_currency=CurrencyType.USD,
                                                        destination_amount=Decimal('1000'),
                                                        destination_currency=CurrencyType.EUR,
                                                        to_account_id=account_db.id,
                                                        income_source_id=income_source_db.id,
                                                        income_period=date(2025, 1, 1))
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data_1.transaction_type,)
    transaction_1: Transaction = await transaction_processor.create(data=income_create_data_1)
    account_balance_before: Decimal = copy(transaction_1.to_account.balance)
    base_currency_rate_before: Decimal = copy(transaction_1.to_account.base_currency_rate)
    await db.commit()

    income_create_data_2: IncomeRequest = IncomeRequest(transaction_date=date(2025, 3, 10),
                                                        source_amount=Decimal('1100'),
                                                        source_currency=CurrencyType.USD,
                                                        destination_amount=Decimal('1000'),
                                                        destination_currency=CurrencyType.EUR,
                                                        to_account_id=account_db.id,
                                                        income_source_id=income_source_db.id,
                                                        income_period=date(2025, 2, 1))

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data_2.transaction_type)
    transaction: Transaction = await transaction_processor.create(data=income_create_data_2)
    await db_transaction.commit()

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

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 2


@pytest.mark.asyncio
async def test_create_income_account_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)
    to_account_id: UUID = uuid4()
    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.USD,
                                                      to_account_id=to_account_id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 18))

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    with pytest.raises(EntityNotFound) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == 'Entity not found'
    assert exc.value.log_message == f"Account not found by {{'id': UUID('{to_account_id}')}}"
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0


@pytest.mark.asyncio
async def test_create_income_currency_mismatch(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 18))

    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    with pytest.raises(CurrencyMismatchException) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == 'Account and transaction currency mismatch'
    assert exc.value.log_message == (f'Transaction currency {income_create_data.destination_currency} differs '
                                     f'from account `{account_db.id}` currency {account_db.currency}')
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.CURRENCY_MISMATCH

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_currency_rate == base_currency_rate_before


@pytest.mark.asyncio
async def test_create_income_account_type_mismatch(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.CHECKING)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.USD,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 18))
    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    with pytest.raises(AccountTypeMismatchException) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.message == 'Account and transaction type mismatch'
    assert exc.value.log_message == (f'Transaction type {TransactionType.INCOME} is not allowed for '
                                     f'account `{account_db.id}` with type {account_db.account_type}')
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_TYPE_MISMATCH

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_currency_rate == base_currency_rate_before


@pytest.mark.asyncio
async def test_create_income_integrity_error(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_id: UUID = uuid4()
    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.USD,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_id,
                                                      income_period=date(2025, 1, 18))
    # Act
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db_transaction,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    with pytest.raises(IntegrityException) as exc:
        await transaction_processor.create(data=income_create_data)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == 'Entity integrity error'
    assert exc.value.log_message == (f'Transaction integrity error: DETAIL:  Key (income_source_id)='
                                     f'({income_source_id}) is not present in table "income_sources".')
    assert exc.value.logger is not None
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[TransactionModel] = (await db.execute(select(TransactionModel))).scalars().all()
    assert len(transactions) == 0
    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == account_balance_before
    assert account_db_after.base_currency_rate == base_currency_rate_before


@pytest.mark.asyncio
async def test_delete_base_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income USD',
                                                       currency=CurrencyType.USD,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1'),
                                                      destination_currency=CurrencyType.USD,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 18))
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction: Transaction = await transaction_service.delete_transaction(db=db_transaction,
                                                                            transaction_id=transaction_before.id,
                                                                            user_id=user_id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal('0')
    assert account_db_after.base_currency_rate == Decimal('0')


@pytest.mark.asyncio
async def test_delete_other_currency_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: AccountCreate = AccountCreate(user_id=user_id,
                                                       name='Income EUR',
                                                       currency=CurrencyType.EUR,
                                                       account_type=AccountType.INCOME)
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1050'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1000'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 1))
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction: Transaction = await transaction_service.delete_transaction(db=db_transaction,
                                                                            transaction_id=transaction_before.id,
                                                                            user_id=user_id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal('0')
    assert account_db_after.base_currency_rate == Decimal('0')


@pytest.mark.asyncio
async def test_delete_other_currency_2_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create_data, commit=True)
    user_id: UUID = user_db.id

    account_create_data: dict = {'user_id': user_id,
                                 'name': 'Income EUR',
                                 'currency': CurrencyType.EUR,
                                 'account_type': AccountType.INCOME,
                                 'balance': Decimal('100'),
                                 'base_currency_rate': Decimal('0.9526')}
    account_db: AccountModel = await account_crud.create(db=db, obj_in=account_create_data, commit=True)
    account_balance_before: Decimal = copy(account_db.balance)
    base_currency_rate_before: Decimal = copy(account_db.base_currency_rate)

    income_source_create_data: IncomeSourceCreate = IncomeSourceCreate(user_id=user_id, name='Best Job')
    income_source_db: IncomeSourceModel = await income_source_crud.create(db=db,
                                                                          obj_in=income_source_create_data, commit=True)

    income_create_data: IncomeRequest = IncomeRequest(transaction_date=date(2025, 2, 10),
                                                      source_amount=Decimal('1050'),
                                                      source_currency=CurrencyType.USD,
                                                      destination_amount=Decimal('1000'),
                                                      destination_currency=CurrencyType.EUR,
                                                      to_account_id=account_db.id,
                                                      income_source_id=income_source_db.id,
                                                      income_period=date(2025, 1, 1))
    transaction_processor: TransactionProcessor = TransactionProcessor.factory(db=db,
                                                                               user_id=user_id,
                                                                               transaction_type=income_create_data.transaction_type)
    transaction_before: Transaction = await transaction_processor.create(data=income_create_data)
    await db.commit()
    await db.close()

    # Act
    transaction: Transaction = await transaction_service.delete_transaction(db=db_transaction,
                                                                            transaction_id=transaction_before.id,
                                                                            user_id=user_id)
    await db_transaction.commit()
    await db_transaction.close()

    # Assert
    assert transaction.status == EntityStatusType.DELETED != transaction_before.status

    transactions: list[TransactionModel] = (await db.scalars(select(TransactionModel))).all()
    assert len(transactions) == 1

    account_db_after: AccountModel = await account_crud.get(db=db, id=account_db.id)
    assert account_db_after.balance == Decimal('100') == account_balance_before
    assert account_db_after.base_currency_rate == Decimal('0.9526') == base_currency_rate_before
