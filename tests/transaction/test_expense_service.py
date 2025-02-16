from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import LogLevelType
from app.crud.expense.category import category_crud
from app.crud.expense.expense import expense_crud
from app.crud.expense.location import location_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.transaction.category import Category as CategoryModel
from app.models.transaction.transaction import Transaction as ExpenseModel
from app.models.transaction.location import Location as LocationModel
from app.models.user.user import User
from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.error_response import ErrorCodeType, ErrorStatusType
from app.schemas.transaction.category import CategoryType
from app.schemas.transaction.transaction import (Transaction, TransactionCreate, TransactionRequest, TransactionUpdate, Order,
                                                 OrderDirectionType, OrderFieldType)
from app.schemas.user.external_user import ProviderType
from app.services.expense import expense_service


@pytest.mark.asyncio
async def test_create_expense_correct_data(db_fixture: AsyncSession):
    # Given
    user_create = User(username='test',
                       registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_id = user_db.id

    category_create = CategoryModel(user_id=user_id,
                                    name='Food',
                                    type=CategoryType.GENERAL,
                                    status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create, commit=True)

    location_create = LocationModel(user_id=user_id,
                                    name='Some shop',
                                    status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    expense_create = TransactionCreate(transaction_date=datetime.now().date(),
                                       transaction_amount=Decimal(10),
                                       transaction_currency=CurrencyType.GEL,
                                       comment='comment',
                                       category_id=category_db.id,
                                       location_id=location_db.id)

    # When
    expense: Transaction = await expense_service.spend(db=db_fixture, spend_data=expense_create,
                                                       user_id=user_id)

    await db_fixture.commit()

    # Then
    assert expense is not None
    assert expense.id is not None
    assert expense.user_id == user_id
    assert expense.transaction_date == expense_create.transaction_date
    assert expense.transaction_amount == expense_service._get_currency_amount(expense_amount=expense_create.transaction_amount,
                                                                              expense_currency=expense_create.transaction_currency,
                                                                              base_currency=CurrencyType.USD)
    assert expense.transaction_amount == expense_create.transaction_amount
    assert expense.transaction_currency == expense_create.transaction_currency
    assert expense.comment == expense_create.comment
    assert expense.category.id == category_db.id
    assert expense.category.user_id == user_id
    assert expense.category.name == category_db.name
    assert expense.category.description == category_db.description
    assert expense.category.type == category_db.type
    assert expense.category.status == category_db.status
    assert expense.location.id == location_db.id
    assert expense.location.user_id == user_id
    assert expense.location.name == location_db.name
    assert expense.location.description == location_db.description
    assert expense.location.status == location_db.status
    assert expense.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_create_expense_incorrect_data(db_fixture: AsyncSession):
    # Given
    user_create = User(username='test',
                       registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_id = user_db.id
    category_id = uuid4()

    expense_create = TransactionCreate(transaction_date=datetime.now().date(),
                                       transaction_amount=Decimal(10),
                                       transaction_currency=CurrencyType.GEL,
                                       comment='comment',
                                       category_id=category_id,
                                       location_id=uuid4())

    # When
    with pytest.raises(IntegrityException) as exc:
        await expense_service.spend(db=db_fixture, spend_data=expense_create, user_id=user_id)

    # Then
    assert exc.value.status_code == ErrorStatusType.HTTP_409_CONFLICT
    assert exc.value.title == 'Entity integrity error'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_message == (f'Expense integrity error: DETAIL:  Key (category_id)=({category_id}) '
                                     f'is not present in table "categories".')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR


async def _create_categories_places_and_expenses(db_fixture: AsyncSession, expenses: bool = True):
    user_create = User(username='test',
                       registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_id = user_db.id
    current_date = datetime.now().date()

    category_ids = []
    location_ids = []
    for i in range(5):
        category_create = CategoryModel(user_id=user_id,
                                        name=f'Category {i}',
                                        description=f'Category description {i}',
                                        type=CategoryType.GENERAL,
                                        status=EntityStatusType.ACTIVE)
        category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create, commit=True)
        category_ids.append(category_db.id)

        location_create = LocationModel(user_id=user_id,
                                        name=f'Place {i}',
                                        description=f'Place description {i}',
                                        status=EntityStatusType.ACTIVE)
        location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)
        location_ids.append(location_db.id)

    if expenses:
        for i in range(1, 6):
            expense_create = ExpenseModel(user_id=user_id,
                                          expense_date=current_date - timedelta(days=i - 1),
                                          amount=expense_service._get_currency_amount(expense_amount=Decimal(10 * i),
                                                                                      expense_currency=CurrencyType.GEL,
                                                                                      base_currency=CurrencyType.USD),
                                          original_amount=Decimal(10 * i),
                                          original_currency=CurrencyType.GEL,
                                          comment=f'comment {i}',
                                          category_id=category_ids[i - 1],
                                          location_id=location_ids[i - 1],
                                          status=EntityStatusType.ACTIVE)
            await expense_crud.create(db=db_fixture, obj_in=expense_create, commit=True)

    return user_id, category_ids, location_ids, current_date


@pytest.mark.asyncio
async def test_get_expense_with_all_fields_filled(db_fixture: AsyncSession):
    # Given
    user_id, category_ids, place_ids, current_date = await _create_categories_places_and_expenses(db_fixture)

    request = TransactionRequest(page=1,
                                 size=3,
                                 orders=[Order(field=OrderFieldType.TRANSACTION_DATE, ordering=OrderDirectionType.DESC),
                                     Order(field=OrderFieldType.CREATED_AT, ordering=OrderDirectionType.DESC)],
                                 date_from=current_date - timedelta(days=3),
                                 date_to=current_date - timedelta(days=1),
                                 category_ids=category_ids[1:4],
                                 place_ids=place_ids[1:4],
                                 statuses=[EntityStatusType.ACTIVE])

    # When
    expenses: Page[Transaction] = await expense_service.get_transactions(db=db_fixture, request=request, user_id=user_id)

    # Then
    assert expenses.total == 3
    for i, expense in enumerate(expenses.items, start=1):
        assert expense.id is not None
        assert expense.user_id == user_id
        assert expense.transaction_date == current_date - timedelta(days=i)
        assert expense.transaction_amount == expense_service._get_currency_amount(expense_amount=Decimal(10 * (i + 1)),
                                                                                  expense_currency=CurrencyType.GEL,
                                                                                  base_currency=CurrencyType.USD)
        assert expense.transaction_amount == Decimal(10 * (i + 1))
        assert expense.transaction_currency == CurrencyType.GEL
        assert expense.comment == f'comment {i + 1}'
        assert expense.category.id == category_ids[i]
        assert expense.category.user_id == user_id
        assert expense.category.name == f'Category {i}'
        assert expense.category.description == f'Category description {i}'
        assert expense.category.type == CategoryType.GENERAL
        assert expense.category.status == EntityStatusType.ACTIVE
        assert expense.location.id == place_ids[i]
        assert expense.location.user_id == user_id
        assert expense.location.name == f'Place {i}'
        assert expense.location.description == f'Place description {i}'
        assert expense.location.status == EntityStatusType.ACTIVE
        assert expense.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_get_expense_with_all_fields_empty(db_fixture: AsyncSession):
    # Given
    user_id, category_ids, place_ids, current_date = await _create_categories_places_and_expenses(db_fixture=db_fixture,
                                                                                                  expenses=True)

    request = TransactionRequest()

    # When
    expenses: Page[Transaction] = await expense_service.get_transactions(db=db_fixture, request=request, user_id=user_id)

    # Then
    assert expenses.total == 5
    for i, expense in enumerate(expenses.items, start=0):
        assert expense.id is not None
        assert expense.user_id == user_id
        assert expense.transaction_date == current_date - timedelta(days=i)
        assert expense.transaction_amount == expense_service._get_currency_amount(expense_amount=Decimal(10 * (i + 1)),
                                                                                  expense_currency=CurrencyType.GEL,
                                                                                  base_currency=CurrencyType.USD)
        assert expense.transaction_amount == Decimal(10 * (i + 1))
        assert expense.transaction_currency == CurrencyType.GEL
        assert expense.comment == f'comment {i + 1}'
        assert expense.category.id == category_ids[i]
        assert expense.category.user_id == user_id
        assert expense.category.name == f'Category {i}'
        assert expense.category.description == f'Category description {i}'
        assert expense.category.type == CategoryType.GENERAL
        assert expense.category.status == EntityStatusType.ACTIVE
        assert expense.location.id == place_ids[i]
        assert expense.location.user_id == user_id
        assert expense.location.name == f'Place {i}'
        assert expense.location.description == f'Place description {i}'
        assert expense.location.status == EntityStatusType.ACTIVE
        assert expense.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_get_expense_with_and_no_expenses(db_fixture: AsyncSession):
    # Given
    user_id, category_ids, place_ids, current_date = await _create_categories_places_and_expenses(db_fixture=db_fixture,
                                                                                                  expenses=False)

    request = TransactionRequest()

    # When
    expenses: Page[Transaction] = await expense_service.get_transactions(db=db_fixture, request=request, user_id=user_id)

    # Then
    assert expenses.total == 0


@pytest.mark.asyncio
async def test_get_expense_by_id(db_fixture: AsyncSession):
    # Given
    user_create = User(username='test',
                       registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_id = user_db.id

    category_create = CategoryModel(user_id=user_id,
                                    name='Food',
                                    type=CategoryType.GENERAL,
                                    status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create, commit=True)

    location_create = LocationModel(user_id=user_id,
                                    name='Some shop',
                                    status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    amount = expense_service._get_currency_amount(expense_amount=Decimal('10'),
                                                  expense_currency=CurrencyType.GEL,
                                                  base_currency=CurrencyType.USD)
    expense_create = ExpenseModel(user_id=user_id,
                                  expense_date=datetime.now().date(),
                                  amount=amount,
                                  original_amount=Decimal('10'),
                                  original_currency=CurrencyType.GEL,
                                  comment=f'comment',
                                  category_id=category_db.id,
                                  location_id=location_db.id,
                                  status=EntityStatusType.ACTIVE)
    expense_db: ExpenseModel = await expense_crud.create(db=db_fixture, obj_in=expense_create, commit=True)

    # When
    expense: Transaction = await expense_service.get_expense_by_id(db=db_fixture, transaction_id=expense_db.id, user_id=user_id)

    # Then
    assert expense is not None
    assert expense.id == expense_db.id
    assert expense.user_id == expense_db.user_id
    assert expense.transaction_date == expense_db.transaction_date
    assert expense.transaction_amount == expense_db.transaction_amount
    assert expense.transaction_amount == expense_db.original_amount
    assert expense.transaction_currency == expense_db.transaction_currency
    assert expense.comment == expense_db.comment
    assert expense.category.id == expense_db.category.id
    assert expense.category.user_id == expense_db.category.user_id
    assert expense.category.name == expense_db.category.name
    assert expense.category.description == expense_db.category.description
    assert expense.category.type == expense_db.category.type
    assert expense.category.status == expense_db.category.status
    assert expense.location.id == expense_db.location.id
    assert expense.location.user_id == expense_db.location.user_id
    assert expense.location.name == expense_db.location.name
    assert expense.location.description == expense_db.location.description
    assert expense.location.status == expense_db.location.status
    assert expense.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_get_expense_by_id_not_found(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    expense_id = uuid4()

    # When
    with pytest.raises(EntityNotFound) as exc:
        await expense_service.get_expense_by_id(db=db_fixture, transaction_id=expense_id, user_id=user_id)

    # Then
    assert exc.value.status_code == ErrorStatusType.HTTP_404_NOT_FOUND
    assert exc.value.title == 'Entity not found'
    search_params = {'id': expense_id, 'user_id': user_id}
    assert exc.value.log_message == f'{ExpenseModel.__name__} not found by {search_params}'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_update_expense(db_fixture: AsyncSession, db: AsyncSession):
    # Given
    user_create = User(username='test',
                       registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_id = user_db.id

    category_create = CategoryModel(user_id=user_id,
                                    name='Food',
                                    type=CategoryType.GENERAL,
                                    status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create, commit=True)

    location_create = LocationModel(user_id=user_id,
                                    name='Some shop',
                                    status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    amount = expense_service._get_currency_amount(expense_amount=Decimal('10'),
                                                  expense_currency=CurrencyType.GEL,
                                                  base_currency=CurrencyType.USD)
    expense_create = ExpenseModel(user_id=user_id,
                                  expense_date=datetime.now().date(),
                                  amount=amount,
                                  original_amount=Decimal('10'),
                                  original_currency=CurrencyType.GEL,
                                  comment=f'comment',
                                  category_id=category_db.id,
                                  location_id=location_db.id,
                                  status=EntityStatusType.ACTIVE)
    expense_db: ExpenseModel = await expense_crud.create(db=db_fixture, obj_in=expense_create, commit=True)
    await db_fixture.commit()

    expense_update = TransactionUpdate(transaction_date=expense_db.transaction_date - timedelta(days=1),
                                       transaction_amount=Decimal('20'),
                                       transaction_currency=CurrencyType.GEL,
                                       comment='comment new',
                                       category_id=expense_db.category_id,
                                       location_id=expense_db.location_id)

    # When
    updated_expense: Transaction = await expense_service.update_expense(db=db, transaction_id=expense_db.id,
                                                                        update_data=expense_update, user_id=user_id)
    await db.commit()

    # Then
    assert updated_expense is not None
    assert updated_expense.id == expense_db.id
    assert updated_expense.user_id == expense_db.user_id
    assert updated_expense.transaction_date == expense_update.transaction_date
    assert updated_expense.transaction_amount == expense_service._get_currency_amount(expense_amount=expense_update.transaction_amount,
                                                                                      expense_currency=expense_update.transaction_currency,
                                                                                      base_currency=CurrencyType.USD)
    assert updated_expense.transaction_amount == expense_update.transaction_amount
    assert updated_expense.transaction_currency == expense_update.transaction_currency
    assert updated_expense.comment == expense_update.comment
    assert updated_expense.category.id == expense_db.category_id
    assert updated_expense.location.id == expense_db.location_id
    assert updated_expense.created_at == expense_db.created_at
    assert updated_expense.updated_at != expense_db.updated_at
    assert updated_expense.status == expense_db.status


@pytest.mark.asyncio
async def test_update_expense_not_found(db_fixture: AsyncSession):
    # Given
    user_create = User(username='test',
                       registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)
    user_id = user_db.id

    category_create = CategoryModel(user_id=user_id,
                                    name='Food',
                                    type=CategoryType.GENERAL,
                                    status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create, commit=True)

    location_create = LocationModel(user_id=user_id,
                                    name='Some shop',
                                    status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    amount = expense_service._get_currency_amount(expense_amount=Decimal('10'),
                                                  expense_currency=CurrencyType.GEL,
                                                  base_currency=CurrencyType.USD)
    expense_create = ExpenseModel(user_id=user_id,
                                  expense_date=datetime.now().date(),
                                  amount=amount,
                                  original_amount=Decimal('10'),
                                  original_currency=CurrencyType.GEL,
                                  comment=f'comment',
                                  category_id=category_db.id,
                                  location_id=location_db.id,
                                  status=EntityStatusType.ACTIVE)
    expense_db: ExpenseModel = await expense_crud.create(db=db_fixture, obj_in=expense_create, commit=True)

    expense_update = TransactionUpdate(transaction_date=expense_db.transaction_date - timedelta(days=1),
                                       transaction_amount=Decimal(20),
                                       transaction_currency=CurrencyType.GEL,
                                       comment='comment new',
                                       category_id=expense_db.category_id,
                                       location_id=expense_db.location_id)

    fake_user_id = uuid4()
    fake_location_id = uuid4()
    expense_update_inegrity = TransactionUpdate(transaction_date=expense_db.transaction_date - timedelta(days=1),
                                                transaction_amount=Decimal('20'),
                                                transaction_currency=CurrencyType.GEL,
                                                comment='comment new',
                                                category_id=expense_db.category_id,
                                                location_id=fake_location_id)

    # When
    with pytest.raises(EntityNotFound) as exc_not_found:
        await expense_service.update_expense(db=db_fixture, transaction_id=expense_db.id, update_data=expense_update,
                                             user_id=fake_user_id)

    with pytest.raises(IntegrityException) as exc_integrity:
        await expense_service.update_expense(db=db_fixture, transaction_id=expense_db.id,
                                             update_data=expense_update_inegrity, user_id=user_id)

    # Then
    assert exc_not_found.value.status_code == ErrorStatusType.HTTP_404_NOT_FOUND
    assert exc_not_found.value.title == 'Entity not found'
    search_params = {'id': fake_user_id}
    assert exc_not_found.value.log_message == f'{User.__name__} not found by {search_params}'
    assert exc_not_found.value.message == exc_not_found.value.log_message
    assert exc_not_found.value.log_level == LogLevelType.ERROR
    assert exc_not_found.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    assert exc_integrity.value.status_code == ErrorStatusType.HTTP_409_CONFLICT
    assert exc_integrity.value.title == 'Entity integrity error'
    assert exc_integrity.value.message == exc_integrity.value.log_message
    assert exc_integrity.value.log_message == (f'Expense integrity error: DETAIL:  '
                                               f'Key (location_id)=({fake_location_id}) '
                                               f'is not present in table "locations".')
    assert exc_integrity.value.log_level == LogLevelType.ERROR
    assert exc_integrity.value.error_code == ErrorCodeType.INTEGRITY_ERROR


@pytest.mark.asyncio
async def test_delete_expense(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    category_create = CategoryModel(user_id=user_id,
                                    name='Food',
                                    type=CategoryType.GENERAL,
                                    status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create, commit=True)

    location_create = LocationModel(user_id=user_id,
                                    name='Some shop',
                                    status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    amount = expense_service._get_currency_amount(expense_amount=Decimal('10'),
                                                  expense_currency=CurrencyType.GEL,
                                                  base_currency=CurrencyType.USD)
    expense_create = ExpenseModel(user_id=user_id,
                                  expense_date=datetime.now().date(),
                                  amount=amount,
                                  original_amount=Decimal('10'),
                                  original_currency=CurrencyType.GEL,
                                  comment=f'comment',
                                  category_id=category_db.id,
                                  location_id=location_db.id,
                                  status=EntityStatusType.ACTIVE)
    expense_db: ExpenseModel = await expense_crud.create(db=db_fixture, obj_in=expense_create, commit=True)

    # When
    await expense_service.delete_expense(db=db_fixture, transaction_id=expense_db.id, user_id=user_id)
    await db_fixture.commit()

    # Then
    expenses_db: list[ExpenseModel] = await expense_crud.get_batch(db=db_fixture, user_id=user_id)
    assert len(expenses_db) == 1
    assert expenses_db[0].status == EntityStatusType.DELETED


@pytest.mark.asyncio
async def test_delete_expense_not_found(db_fixture: AsyncSession):
    # Given
    fake_user_id = uuid4()
    fake_expense_id = uuid4()

    # When
    with pytest.raises(EntityNotFound) as exc:
        await expense_service.delete_expense(db=db_fixture, transaction_id=fake_expense_id, user_id=fake_user_id)

    # Then
    assert exc.value.status_code == ErrorStatusType.HTTP_404_NOT_FOUND
    assert exc.value.title == 'Entity not found'
    search_params = {'id': fake_expense_id, 'user_id': fake_user_id}
    assert exc.value.log_message == f'{ExpenseModel.__name__} not found by {search_params}'
    assert exc.value.message == exc.value.log_message
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
