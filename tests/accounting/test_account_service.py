from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.configs.settings import settings
from app.crud.accounting.account import account_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import AccountDeletionForbidden, MaxAccountsReached
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.account import Account, AccountCreateRequest, AccountType, AccountUpdate
from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import account_service


@pytest.mark.asyncio
async def test_create_account_ok(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name='test name',
                                                             description='test description',
                                                             currency=CurrencyType.USD,
                                                             account_type=AccountType.INCOME)
    # Act
    account: Account = await account_service.create_account(db=db_fixture, user_id=user_id, create_data=create_data)
    await db_fixture.commit()

    # Assert
    assert account.id is not None
    assert account.name == create_data.name
    assert account.description == create_data.description
    assert account.user_id == user_id
    assert account.balance == Decimal('0')
    assert account.currency == create_data.currency
    assert account.base_currency_rate == Decimal('0')
    assert account.account_type == create_data.account_type
    assert account.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_create_account_existing_name(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name='test name',
                                                             description='test description',
                                                             currency=CurrencyType.USD,
                                                             account_type=AccountType.INCOME)
    await account_service.create_account(db=db_fixture, user_id=user_id, create_data=create_data)
    await db_fixture.commit()

    # Act
    with pytest.raises(IntegrityException) as exc:
        await account_service.create_account(db=db_fixture, create_data=create_data, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.title == 'Entity integrity error'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_message == (f'Account integrity error: DETAIL:  Key (user_id, name)=({user_id}, '
                                     f'{create_data.name}) already exists.')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR


@pytest.mark.asyncio
async def test_create_account_max_limit(db_fixture: AsyncSession, monkeypatch):
    # Arrange
    user_id: UUID = uuid4()

    monkeypatch.setattr(settings, 'max_accounts_per_user', 2)
    for i in range(settings.max_accounts_per_user):
        create_data: AccountCreateRequest = AccountCreateRequest(name=f'test name {i}',
                                                                 description=f'test description {i}',
                                                                 currency=CurrencyType.USD,
                                                                 account_type=AccountType.INCOME)
        await account_service.create_account(db=db_fixture, user_id=user_id, create_data=create_data)
    await db_fixture.commit()

    create_data: AccountCreateRequest = AccountCreateRequest(name='test name',
                                                             description='test description',
                                                             currency=CurrencyType.USD,
                                                             account_type=AccountType.INCOME)

    # Act
    with pytest.raises(MaxAccountsReached) as exc:
        await account_service.create_account(db=db_fixture, user_id=user_id, create_data=create_data)

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.title == 'Max accounts per user'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_message == (f'Max number of accounts ({settings.max_accounts_per_user}) '
                                     f'reached for user_id `{user_id}`')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.MAX_ACCOUNTS_PER_USER


@pytest.mark.asyncio
async def test_get_accounts(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    for i in range(5):
        create_data: AccountCreateRequest = AccountCreateRequest(name=f'test name {i}',
                                                                 description=f'test description {i}',
                                                                 currency=CurrencyType.USD,
                                                                 account_type=AccountType.INCOME)
        await account_service.create_account(db=db_fixture, user_id=user_id, create_data=create_data)
    await db_fixture.commit()

    # Act
    accounts: list[Account] = await account_service.get_accounts(db=db_fixture, user_id=user_id)

    # Assert
    assert len(accounts) == 5


@pytest.mark.asyncio
async def test_get_accounts_no_accounts(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    # Act
    accounts: list[Account] = await account_service.get_accounts(db=db_fixture, user_id=user_id)

    # Assert
    assert len(accounts) == 0


@pytest.mark.asyncio
async def test_get_account_ok(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name='test name',
                                                             description='test description',
                                                             currency=CurrencyType.USD,
                                                             account_type=AccountType.INCOME)
    account_created: Account = await account_service.create_account(db=db_fixture, user_id=user_id,
                                                                    create_data=create_data)
    await db_fixture.commit()

    # Act
    account: Account = await account_service.get_account(db=db_fixture, account_id=account_created.id, user_id=user_id)

    await db_fixture.commit()

    # Assert
    assert account.id == account_created.id
    assert account.name == account_created.name
    assert account.description == account_created.description
    assert account.user_id == account_created.user_id
    assert account.balance == account_created.balance
    assert account.currency == account_created.currency
    assert account.base_currency_rate == account_created.base_currency_rate
    assert account.account_type == account_created.account_type
    assert account.status == account_created.status


@pytest.mark.asyncio
async def test_get_account_not_found(db_fixture: AsyncSession):
    # Arrange
    user_id = uuid4()
    account_id = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await account_service.get_account(db=db_fixture, account_id=account_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.title == 'Entity not found'
    search_params = {'id': account_id, 'user_id': user_id}
    assert exc.value.log_message == f'{AccountModel.__name__} not found by {search_params}'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_update_account_ok(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name='test name',
                                                             description='test description',
                                                             currency=CurrencyType.USD,
                                                             account_type=AccountType.INCOME)
    account_created: Account = await account_service.create_account(db=db_fixture, user_id=user_id,
                                                                    create_data=create_data)
    await db_fixture.commit()

    update_data: AccountUpdate = AccountUpdate(name='updated name', description='updated description')

    # Act
    account: Account = await account_service.update_account(db=db_fixture, account_id=account_created.id,
                                                            user_id=user_id,
                                                            update_data=update_data)

    # Assert
    assert account.id == account_created.id
    assert account.name == update_data.name
    assert account.description == update_data.description
    assert account.user_id == account_created.user_id
    assert account.balance == account_created.balance
    assert account.currency == account_created.currency
    assert account.base_currency_rate == account_created.base_currency_rate
    assert account.account_type == account_created.account_type
    assert account.status == account_created.status


@pytest.mark.asyncio
async def test_update_account_not_found(db_fixture: AsyncSession):
    # Arrange
    user_id = uuid4()
    account_id = uuid4()

    update_data: AccountUpdate = AccountUpdate(name='updated name', description='updated description')

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await account_service.update_account(db=db_fixture, account_id=account_id, user_id=user_id,
                                             update_data=update_data)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.title == 'Entity not found'
    search_params = {'id': account_id, 'user_id': user_id}
    assert exc.value.log_message == f'{AccountModel.__name__} not found by {search_params}'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_update_account_double(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data_1: AccountCreateRequest = AccountCreateRequest(name='Account 1',
                                                               currency=CurrencyType.USD,
                                                               account_type=AccountType.INCOME)
    account_created_1: Account = await account_service.create_account(db=db_fixture, user_id=user_id,
                                                                      create_data=create_data_1)

    create_data_2: AccountCreateRequest = AccountCreateRequest(name='Account 2',
                                                               currency=CurrencyType.USD,
                                                               account_type=AccountType.INCOME)
    await account_service.create_account(db=db_fixture, user_id=user_id,
                                         create_data=create_data_2)
    await db_fixture.commit()

    update_data: AccountUpdate = AccountUpdate(name='Account 2')

    # Act
    with pytest.raises(IntegrityException) as exc:
        await account_service.update_account(db=db_fixture, account_id=account_created_1.id, user_id=user_id,
                                             update_data=update_data)

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.title == 'Entity integrity error'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_message == (f'Account integrity error: DETAIL:  Key (user_id, name)=({user_id}, '
                                     f'{create_data_2.name}) already exists.')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR


@pytest.mark.asyncio
async def test_delete_account_ok(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: AccountCreateRequest = AccountCreateRequest(name='test name',
                                                             description='test description',
                                                             currency=CurrencyType.USD,
                                                             account_type=AccountType.INCOME)
    account_created: Account = await account_service.create_account(db=db_fixture, user_id=user_id,
                                                                    create_data=create_data)
    await db_fixture.commit()

    # Act
    deleted_account: Account = await account_service.delete_account(db=db_fixture, account_id=account_created.id,
                                                                    user_id=user_id)

    # Assert
    assert deleted_account.id == account_created.id
    assert deleted_account.name == account_created.name
    assert deleted_account.description == account_created.description
    assert deleted_account.user_id == account_created.user_id
    assert deleted_account.balance == Decimal('0')
    assert deleted_account.currency == account_created.currency
    assert deleted_account.base_currency_rate == account_created.base_currency_rate
    assert deleted_account.account_type == account_created.account_type
    assert deleted_account.status == EntityStatusType.DELETED


@pytest.mark.asyncio
async def test_delete_account_not_found(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    account_id: UUID = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await account_service.delete_account(db=db_fixture, account_id=account_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.title == 'Entity not found'
    search_params = {'id': account_id, 'user_id': user_id}
    assert exc.value.log_message == f'{AccountModel.__name__} not found by {search_params}'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_delete_account_balance_not_zero(db_fixture: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: dict = {'user_id': user_id,
                         'name': 'Checking USD',
                         'currency': CurrencyType.USD,
                         'account_type': AccountType.CHECKING,
                         'base_currency_rate': Decimal('1'),
                         'balance': Decimal('1')}
    account_db: AccountModel = await account_crud.create(db=db_fixture, obj_in=create_data, commit=True)

    # Act
    with pytest.raises(AccountDeletionForbidden) as exc:
        await account_service.delete_account(db=db_fixture, account_id=account_db.id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc.value.title == 'Account deletion forbidden'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_message == f'Account `{account_db.id}` can not be deleted. Account balance is not 0'
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ACCOUNT_DELETION_FORBIDDEN
