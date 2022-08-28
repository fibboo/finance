import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest
from pydantic import parse_obj_as

from app.exceptions.exception import NotFoundEntity
from app.schemas.base import EntityStatusType
from app.schemas.expense.expense import (ExpenseCreate, Expense, ExpenseRequest, OrderFieldType, OrderDirectionType,
                                         ExpenseUpdate)
from app.schemas.expense.expense_category import ExpenseCategoryCreate, ExpenseType, ExpenseCategory
from app.schemas.expense.expense_place import ExpensePlaceCreate, ExpensePlace
from app.services.expense import expense_service


@pytest.mark.asyncio
async def test_create_expense_correct_data(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Food',
        description='Food expenses',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpenseCategory {
                    user_id := <uuid>$user_id,
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, type, name, description, status}
            """
    expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)

    place_create = ExpensePlaceCreate(
        name='Some shop',
        description='Some shop description',
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)

    current_date = datetime.now(timezone(timedelta(hours=0))).replace(second=0, microsecond=0)
    expense_create = ExpenseCreate(
        datetime=current_date,
        amount=Decimal(10),
        comment='comment',
        category_id=expense_category.id,
        place_id=expense_place.id
    )

    # When
    expense: Expense = await expense_service.create_expense(expense_create=expense_create, user_id=user_id)

    # Then
    assert expense is not None
    assert expense.id is not None
    assert expense.user_id == user_id
    assert expense.datetime == expense_create.datetime
    assert expense.amount == expense_create.amount
    assert expense.comment == expense_create.comment
    assert expense.category.id == expense_category.id
    assert expense.category.user_id == user_id
    assert expense.category.name == expense_category.name
    assert expense.category.description == expense_category.description
    assert expense.category.type == expense_category.type
    assert expense.category.status == expense_category.status
    assert expense.place.id == expense_place.id
    assert expense.place.user_id == user_id
    assert expense.place.name == expense_place.name
    assert expense.place.description == expense_place.description
    assert expense.place.status == expense_place.status


@pytest.mark.asyncio
async def test_create_expense_incorrect_data(db):
    # Given
    user_id = uuid.uuid4()

    current_date = datetime.now(timezone(timedelta(hours=0))).replace(second=0, microsecond=0)
    expense_create = ExpenseCreate(
        datetime=current_date,
        amount=Decimal(10),
        comment='comment',
        category_id=uuid.uuid4(),
        place_id=uuid.uuid4(),
    )

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await expense_service.create_expense(expense_create=expense_create, user_id=user_id)

    # Then
    assert exc.value.message in (f'Expense category or place not found by user_id #{user_id} and entity id. '
                                 f'category_id: {expense_create.category_id}, place_id: {expense_create.place_id}')


async def _create_categories_places_and_expenses(db, expenses: bool = True):
    user_id = uuid.uuid4()
    current_date = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    category_ids = []
    for i in range(5):
        category_create = ExpenseCategoryCreate(
            name=f'Category {i}',
            description=f'Category description {i}',
            type=ExpenseType.GENERAL,
            status=EntityStatusType.ACTIVE,
        )
        query = """
                SELECT (
                    INSERT expense::ExpenseCategory {
                        user_id := <uuid>$user_id,
                        type := <str>$type,
                        name := <str>$name,
                        description := <optional str>$description,
                        status := <str>$status
                    }) {id, user_id, type, name, description, status}
                """
        expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
        category_ids.append(parse_obj_as(ExpenseCategory, expense_category_db).id)

    place_ids = []
    for i in range(5):
        place_create = ExpensePlaceCreate(
            name=f'Place {i}',
            description=f'Place description {i}',
            status=EntityStatusType.ACTIVE,
        )
        query = """
                SELECT (
                    INSERT expense::ExpensePlace {
                        user_id := <uuid>$user_id,
                        name := <str>$name,
                        description := <optional str>$description,
                        status := <str>$status
                    }) {id, user_id, name, description, status}
                """
        expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)
        place_ids.append(parse_obj_as(ExpensePlace, expense_place_db).id)

    if expenses:
        for i in range(1, 6):
            expense_create = ExpenseCreate(
                datetime=current_date - timedelta(days=i - 1),
                amount=Decimal(10 * i),
                comment=f'comment {i}',
                category_id=category_ids[i - 1],
                place_id=place_ids[i - 1],
            )
            await expense_service.create_expense(expense_create=expense_create, user_id=user_id)

    return user_id, category_ids, place_ids, current_date


@pytest.mark.asyncio
async def test_get_expense_with_all_fields_filled(db):
    # Given
    user_id, category_ids, place_ids, current_date = await _create_categories_places_and_expenses(db)

    request = ExpenseRequest(
        skip=0,
        size=3,
        order_field=OrderFieldType.amount,
        order_direction=OrderDirectionType.asc,
        date_from=current_date - timedelta(days=3),
        date_to=current_date - timedelta(days=1),
        category_ids=category_ids[1:4],
        place_ids=place_ids[1:4],
    )

    # When
    expenses: list[Expense] = await expense_service.get_expenses(request=request, user_id=user_id)

    # Then
    assert len(expenses) == 3
    for i, expense in enumerate(expenses, start=1):
        assert expense.id is not None
        assert expense.user_id == user_id
        assert expense.datetime == current_date - timedelta(days=i)
        assert expense.amount == Decimal(10 * (i + 1))
        assert expense.comment == f'comment {i + 1}'
        assert expense.category.id == category_ids[i]
        assert expense.category.user_id == user_id
        assert expense.category.name == f'Category {i}'
        assert expense.category.description == f'Category description {i}'
        assert expense.category.type == ExpenseType.GENERAL
        assert expense.category.status == EntityStatusType.ACTIVE
        assert expense.place.id == place_ids[i]
        assert expense.place.user_id == user_id
        assert expense.place.name == f'Place {i}'
        assert expense.place.description == f'Place description {i}'
        assert expense.place.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_get_expense_with_all_fields_empty(db):
    # Given
    user_id, category_ids, place_ids, current_date = await _create_categories_places_and_expenses(db, expenses=True)

    request = ExpenseRequest()

    # When
    expenses: list[Expense] = await expense_service.get_expenses(request=request, user_id=user_id)

    # Then
    assert len(expenses) == 5
    for i, expense in enumerate(expenses, start=0):
        assert expense.id is not None
        assert expense.user_id == user_id
        assert expense.datetime == current_date - timedelta(days=i)
        assert expense.amount == Decimal(10 * (i + 1))
        assert expense.comment == f'comment {i + 1}'
        assert expense.category.id == category_ids[i]
        assert expense.category.user_id == user_id
        assert expense.category.name == f'Category {i}'
        assert expense.category.description == f'Category description {i}'
        assert expense.category.type == ExpenseType.GENERAL
        assert expense.category.status == EntityStatusType.ACTIVE
        assert expense.place.id == place_ids[i]
        assert expense.place.user_id == user_id
        assert expense.place.name == f'Place {i}'
        assert expense.place.description == f'Place description {i}'
        assert expense.place.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_get_expense_with_and_no_expenses(db):
    # Given
    user_id, category_ids, place_ids, current_date = await _create_categories_places_and_expenses(db, expenses=False)

    request = ExpenseRequest()

    # When
    expenses: list[Expense] = await expense_service.get_expenses(request=request, user_id=user_id)

    # Then
    assert len(expenses) == 0


@pytest.mark.asyncio
async def test_get_expense_by_id(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Food',
        description='Food expenses',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpenseCategory {
                    user_id := <uuid>$user_id,
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, type, name, description, status}
            """
    expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)

    place_create = ExpensePlaceCreate(
        name='Some shop',
        description='Some shop description',
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)

    current_date = datetime.now(timezone(timedelta(hours=0))).replace(second=0, microsecond=0)
    expense_create = ExpenseCreate(
        datetime=current_date,
        amount=Decimal(10),
        comment='comment',
        category_id=expense_category.id,
        place_id=expense_place.id
    )
    created_expense = await expense_service.create_expense(expense_create, user_id)

    # When
    expense: Expense = await expense_service.get_expense_by_id(expense_id=created_expense.id, user_id=user_id)

    # Then
    assert expense is not None
    assert expense.id == created_expense.id
    assert expense.user_id == created_expense.user_id
    assert expense.datetime == created_expense.datetime
    assert expense.amount == created_expense.amount
    assert expense.comment == created_expense.comment
    assert expense.category.id == created_expense.category.id
    assert expense.category.user_id == created_expense.category.user_id
    assert expense.category.name == created_expense.category.name
    assert expense.category.description == created_expense.category.description
    assert expense.category.type == created_expense.category.type
    assert expense.category.status == created_expense.category.status
    assert expense.place.id == created_expense.place.id
    assert expense.place.user_id == created_expense.place.user_id
    assert expense.place.name == created_expense.place.name
    assert expense.place.description == created_expense.place.description
    assert expense.place.status == created_expense.place.status


@pytest.mark.asyncio
async def test_get_expense_by_id_not_found(db):
    # Given
    user_id = uuid.uuid4()
    expense_id = uuid.uuid4()

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await expense_service.get_expense_by_id(expense_id=expense_id, user_id=user_id)

    # Then
    assert exc.value.message in f'Expense not found by user_id #{user_id} and entity id #{expense_id}.'


@pytest.mark.asyncio
async def test_update_expense(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Food',
        description='Food expenses',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpenseCategory {
                    user_id := <uuid>$user_id,
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, type, name, description, status}
            """
    expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)

    place_create = ExpensePlaceCreate(
        name='Some shop',
        description='Some shop description',
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)

    current_date = datetime.now(timezone(timedelta(hours=0))).replace(second=0, microsecond=0)
    expense_create = ExpenseCreate(
        datetime=current_date,
        amount=Decimal(10),
        comment='comment',
        category_id=expense_category.id,
        place_id=expense_place.id
    )
    created_expense = await expense_service.create_expense(expense_create, user_id)

    expense_update = ExpenseUpdate(
        id=created_expense.id,
        datetime=created_expense.datetime - timedelta(days=1),
        amount=Decimal(20),
        comment='comment new',
        category_id=created_expense.category.id,
        place_id=created_expense.place.id,
    )

    # When
    updated_expense = await expense_service.update_expense(expense_update, user_id)

    # Then
    assert updated_expense is not None
    assert updated_expense.id == expense_update.id
    assert updated_expense.user_id == created_expense.user_id
    assert updated_expense.datetime == expense_update.datetime
    assert updated_expense.amount == expense_update.amount
    assert updated_expense.comment == expense_update.comment
    assert updated_expense.category.id == expense_update.category_id
    assert updated_expense.place.id == expense_update.place_id


@pytest.mark.asyncio
async def test_update_expense_not_found(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Food',
        description='Food expenses',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpenseCategory {
                    user_id := <uuid>$user_id,
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, type, name, description, status}
            """
    expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)

    place_create = ExpensePlaceCreate(
        name='Some shop',
        description='Some shop description',
        status=EntityStatusType.ACTIVE,
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)

    current_date = datetime.now(timezone(timedelta(hours=0))).replace(second=0, microsecond=0)
    expense_create = ExpenseCreate(
        datetime=current_date,
        amount=Decimal(10),
        comment='comment',
        category_id=expense_category.id,
        place_id=expense_place.id
    )
    created_expense = await expense_service.create_expense(expense_create, user_id)

    fake_user_id = uuid.uuid4()
    fake_expense_id = uuid.uuid4()
    fake_category_id = uuid.uuid4()
    fake_place_id = uuid.uuid4()
    expense_update = ExpenseUpdate(
        id=fake_expense_id,
        datetime=created_expense.datetime - timedelta(days=1),
        amount=Decimal(20),
        comment='comment new',
        category_id=fake_category_id,
        place_id=fake_place_id,
    )

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await expense_service.update_expense(expense_update, fake_user_id)

    # Then
    assert exc.value.message == (f'Expense not found by user_id #{fake_user_id} and entity id #{expense_update.id} or '
                                 f'category or place not found by id. '
                                 f'category_id: {expense_update.category_id}, place_id: {expense_update.place_id}')


@pytest.mark.asyncio
async def test_delete_expense(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Food',
        description='Food expenses',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE,
    )
    query = """
                SELECT (
                    INSERT expense::ExpenseCategory {
                        user_id := <uuid>$user_id,
                        type := <str>$type,
                        name := <str>$name,
                        description := <optional str>$description,
                        status := <str>$status
                    }) {id, user_id, type, name, description, status}
                """
    expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)

    place_create = ExpensePlaceCreate(
        name='Some shop',
        description='Some shop description',
        status=EntityStatusType.ACTIVE,
    )
    query = """
                SELECT (
                    INSERT expense::ExpensePlace {
                        user_id := <uuid>$user_id,
                        name := <str>$name,
                        description := <optional str>$description,
                        status := <str>$status
                    }) {id, user_id, name, description, status}
                """
    expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)

    current_date = datetime.now(timezone(timedelta(hours=0))).replace(second=0, microsecond=0)
    expense_create = ExpenseCreate(
        datetime=current_date,
        amount=Decimal(10),
        comment='comment',
        category_id=expense_category.id,
        place_id=expense_place.id
    )
    created_expense = await expense_service.create_expense(expense_create, user_id)

    # When
    await expense_service.delete_expense(created_expense.id, user_id)

    # Then
    query = 'SELECT expense::Expense FILTER .id = <uuid>$expense_id AND .user_id = <uuid>$user_id'
    expenses_db = await db.query(query, expense_id=created_expense.id, user_id=user_id)
    assert len(expenses_db) == 0


@pytest.mark.asyncio
async def test_delete_expense_not_found(db):
    # Given
    fake_user_id = uuid.uuid4()
    fake_expense_id = uuid.uuid4()

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await expense_service.delete_expense(fake_expense_id, fake_user_id)

    # Then
    assert exc.value.message == f'Expense not found by user_id #{fake_user_id} and entity id #{fake_expense_id}.'
