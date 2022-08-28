import uuid

import pytest
from pydantic import parse_obj_as

from app.exceptions.exception import ProcessingException, NotFoundEntity
from app.schemas.base import EntityStatusType
from app.schemas.expense.expense_category import (ExpenseCategory, ExpenseCategoryCreate, ExpenseType,
                                                  ExpenseCategorySearch, ExpenseCategoryUpdate,
                                                  ExpenseCategoryUpdateStatus)
from app.services.expense import category_service


@pytest.mark.asyncio
async def test_create_expense_category(db):
    # Given
    user_id = uuid.uuid4()
    category_create = ExpenseCategoryCreate(
        name='Category 1',
        description='Category 1 description',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE
    )

    # When
    category: ExpenseCategory = await category_service.create_expense_category(category_create=category_create,
                                                                               user_id=user_id)

    # Then
    assert category is not None
    assert category.id is not None
    assert category.user_id == user_id
    assert category.name == category_create.name
    assert category.description == category_create.description
    assert category.type == category_create.type
    assert category.status == category_create.status


@pytest.mark.asyncio
async def test_create_expense_category_with_existing_name(db):
    # Given
    user_id = uuid.uuid4()
    category_create = ExpenseCategoryCreate(
        name='Category 1',
        description='Category 1 description',
        type=ExpenseType.GENERAL,
        status=EntityStatusType.ACTIVE
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
    await db.query_single(query, **category_create.dict(), user_id=user_id)

    # When
    with pytest.raises(ProcessingException) as exc:
        await category_service.create_expense_category(category_create=category_create, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense category with name `{category_create.name}` already exists.'


async def _create_categories(db):
    user_id = uuid.uuid4()
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

    for i in range(5):
        category_create = ExpenseCategoryCreate(
            name=f'Category {i}{i}',
            description=f'Category description {i}{i}',
            type=ExpenseType.TARGET,
            status=EntityStatusType.DELETED,
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

    return user_id


@pytest.mark.asyncio
async def test_search_expense_categories_with_all_fields_filled(db):
    # Given
    user_id = await _create_categories(db)

    request = ExpenseCategorySearch(
        search_term='Cat',
        types=[ExpenseType.GENERAL],
        statuses=[EntityStatusType.ACTIVE]
    )

    # When
    categories: list[ExpenseCategory] = await category_service.search_expense_categories(request=request,
                                                                                         user_id=user_id)

    # Then
    assert len(categories) == 5
    for category in categories:
        assert category.id is not None
        assert category.user_id == user_id
        assert category.name.startswith('Category')
        assert category.description.startswith('Category description')
        assert category.type == ExpenseType.GENERAL
        assert category.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_search_expense_categories_with_all_fields_empty(db):
    # Given
    user_id = await _create_categories(db)

    # When
    categories: list[ExpenseCategory] = await category_service.search_expense_categories(
        request=ExpenseCategorySearch(),
        user_id=user_id)

    # Then
    assert len(categories) == 10
    for category in categories:
        assert category.id is not None
        assert category.user_id == user_id
        assert category.name.startswith('Category')
        assert category.description.startswith('Category description')
        assert category.type in [ExpenseType.GENERAL, ExpenseType.TARGET]
        assert category.status in [EntityStatusType.ACTIVE, EntityStatusType.DELETED]


@pytest.mark.asyncio
async def test_search_expense_categories_nothing_found(db):
    # Given
    user_id = await _create_categories(db)

    request = ExpenseCategorySearch(
        search_term='nothing',
    )

    # When
    categories: list[ExpenseCategory] = await category_service.search_expense_categories(request=request,
                                                                                         user_id=user_id)

    # Then
    assert len(categories) == 0


@pytest.mark.asyncio
async def test_get_expense_category_by_id_correct_data(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Category 1',
        description='Category 1 description',
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
    created_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    created_category = parse_obj_as(ExpenseCategory, created_category_db)

    # When
    category: ExpenseCategory = await category_service.get_expense_category_by_id(category_id=created_category.id,
                                                                                  user_id=user_id)

    # Then
    assert category is not None
    assert category.id == created_category.id
    assert category.user_id == created_category.user_id
    assert category.name == created_category.name
    assert category.description == created_category.description
    assert category.type == created_category.type
    assert category.status == created_category.status


@pytest.mark.asyncio
async def test_get_expense_category_by_id_incorrect_data(db):
    # Given
    user_id = uuid.uuid4()
    category_id = uuid.uuid4()

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await category_service.get_expense_category_by_id(category_id=category_id, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense category not found by user_id #{user_id} and entity id #{category_id}.'


@pytest.mark.asyncio
async def test_update_expense_category_correct_data(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Category 1',
        description='Category 1 description',
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
    created_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    created_category = parse_obj_as(ExpenseCategory, created_category_db)

    category_update = ExpenseCategoryUpdate(
        id=created_category.id,
        name='Category 1 updated',
        description='Category 1 description updated',
        type=ExpenseType.TARGET,
    )

    # When
    category: ExpenseCategory = await category_service.update_expense_category(request=category_update,
                                                                               user_id=user_id)

    # Then
    assert category is not None
    assert category.id == created_category.id
    assert category.user_id == created_category.user_id
    assert category.name == category_update.name
    assert category.description == category_update.description
    assert category.type == category_update.type
    assert category.status == created_category.status


@pytest.mark.asyncio
async def test_update_expense_category_incorrect_data(db):
    # Given
    user_id = uuid.uuid4()
    category_id = uuid.uuid4()

    category_update = ExpenseCategoryUpdate(
        id=category_id,
        name='Category 1 updated',
        description='Category 1 description updated',
        type=ExpenseType.TARGET,
    )

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await category_service.update_expense_category(request=category_update, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense category not found by user_id #{user_id} and entity id #{category_id}.'


@pytest.mark.asyncio
async def test_update_expense_category_status_correct_data(db):
    # Given
    user_id = uuid.uuid4()

    category_create = ExpenseCategoryCreate(
        name='Category 1',
        description='Category 1 description',
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
    created_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)
    created_category = parse_obj_as(ExpenseCategory, created_category_db)

    category_update = ExpenseCategoryUpdateStatus(
        id=created_category.id,
        status=EntityStatusType.DELETED,
    )

    # When
    category: ExpenseCategory = await category_service.update_expense_category_status(request=category_update,
                                                                                      user_id=user_id)

    # Then
    assert category is not None
    assert category.id == created_category.id
    assert category.user_id == created_category.user_id
    assert category.name == created_category.name
    assert category.description == created_category.description
    assert category.type == created_category.type
    assert category.status == category_update.status


@pytest.mark.asyncio
async def test_update_expense_category_status_incorrect_data(db):
    # Given
    user_id = uuid.uuid4()
    category_id = uuid.uuid4()

    category_update = ExpenseCategoryUpdateStatus(
        id=category_id,
        status=EntityStatusType.DELETED,
    )

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await category_service.update_expense_category_status(request=category_update, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense category not found by user_id #{user_id} and entity id #{category_id}.'
