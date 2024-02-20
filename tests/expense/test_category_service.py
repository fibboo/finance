from uuid import uuid4

import pytest
from fastapi_pagination import Page
from pydantic import parse_obj_as
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.expense.category import category_crud
from app.exceptions.exception import ProcessingException, NotFoundException, IntegrityExistException
from app.models import Category as CategoryModel
from app.schemas.base import EntityStatusType
from app.schemas.expense.category import CategoryCreate, Category, CategorySearch, CategoryUpdate, CategoryType
from app.services.expense import category_service


@pytest.mark.asyncio
async def test_create_category(db: AsyncSession):
    # Given
    user_id = uuid4()
    category_create = CategoryCreate(name='Category 1',
                                     type=CategoryType.GENERAL)

    # When
    category: Category = await category_service.create_category(db=db, category_create=category_create, user_id=user_id)
    await db.commit()

    # Then
    assert category is not None
    assert category.id is not None
    assert category.user_id == user_id
    assert category.name == category_create.name
    assert category.description == category_create.description
    assert category.type == category_create.type
    assert category.status == EntityStatusType.ACTIVE
    assert category.created_at is not None
    assert category.updated_at is not None


@pytest.mark.asyncio
async def test_create_category_with_existing_name(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    category_create_model = CategoryModel(user_id=user_id,
                                          name='Category 1',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    category_create = CategoryCreate(name='Category 1', type=CategoryType.GENERAL, )

    # When
    with pytest.raises(ProcessingException) as exc:
        await category_service.create_category(db=db_fixture, category_create=category_create, user_id=user_id)

    # Then
    assert exc.value.message == (f'Category integrity exception: DETAIL:  Key (user_id, name, status)=({user_id}, '
                                 f'{category_create_model.name}, ACTIVE) already exists.')


@pytest.mark.asyncio
async def test_search_categories_with_all_fields_filled(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    for i in range(5):
        category_create_model = CategoryModel(user_id=user_id,
                                              name=f'Category {i}',
                                              description=f'Category description {i}',
                                              type=CategoryType.GENERAL,
                                              status=EntityStatusType.ACTIVE)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

        category_create_model = CategoryModel(user_id=user_id,
                                              name=f'Category {i}{i}',
                                              description=f'Category description {i}{i}',
                                              type=CategoryType.TARGET,
                                              status=EntityStatusType.DELETED)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

        category_create_model = CategoryModel(user_id=uuid4(),
                                              name=f'Category {i}{i}{i}',
                                              description=f'Category description {i}{i}{i}',
                                              type=CategoryType.GENERAL,
                                              status=EntityStatusType.ACTIVE)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    request = CategorySearch(search_term='Cat', types=[CategoryType.GENERAL], statuses=[EntityStatusType.ACTIVE])

    # When
    categories: Page[Category] = await category_service.get_categories(db=db_fixture, request=request,
                                                                       user_id=user_id)

    # Then
    assert categories.total == 5
    for category in categories.items:
        assert category.id is not None
        assert category.user_id == user_id
        assert category.name.startswith('Category')
        assert category.description.startswith('Category description')
        assert category.type == CategoryType.GENERAL
        assert category.status == EntityStatusType.ACTIVE
        assert category.created_at is not None
        assert category.updated_at is not None


@pytest.mark.asyncio
async def test_search_categories_with_all_fields_empty(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    for i in range(5):
        category_create_model = CategoryModel(user_id=user_id,
                                              name=f'Category {i}',
                                              description=f'Category description {i}',
                                              type=CategoryType.GENERAL,
                                              status=EntityStatusType.ACTIVE)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

        category_create_model = CategoryModel(user_id=user_id,
                                              name=f'Category {i}{i}',
                                              description=f'Category description {i}{i}',
                                              type=CategoryType.TARGET,
                                              status=EntityStatusType.DELETED)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

        category_create_model = CategoryModel(user_id=uuid4(),
                                              name=f'Category {i}{i}{i}',
                                              description=f'Category description {i}{i}{i}',
                                              type=CategoryType.GENERAL,
                                              status=EntityStatusType.ACTIVE)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    request = CategorySearch(statuses=[EntityStatusType.ACTIVE, EntityStatusType.DELETED])

    # When
    categories: Page[Category] = await category_service.get_categories(db=db_fixture, request=request,
                                                                       user_id=user_id)

    # Then
    assert categories.total == 10
    for category in categories.items:
        assert category.id is not None
        assert category.user_id == user_id
        assert category.name.startswith('Category')
        assert category.description.startswith('Category description')
        assert category.type in [CategoryType.GENERAL, CategoryType.TARGET]
        assert category.status in [EntityStatusType.ACTIVE, EntityStatusType.DELETED]
        assert category.created_at is not None
        assert category.updated_at is not None


@pytest.mark.asyncio
async def test_search_categories_nothing_found(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    for i in range(5):
        category_create_model = CategoryModel(user_id=user_id,
                                              name=f'Category {i}',
                                              description=f'Category description {i}',
                                              type=CategoryType.GENERAL,
                                              status=EntityStatusType.ACTIVE)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

        category_create_model = CategoryModel(user_id=user_id,
                                              name=f'Category {i}{i}',
                                              description=f'Category description {i}{i}',
                                              type=CategoryType.TARGET,
                                              status=EntityStatusType.DELETED)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

        category_create_model = CategoryModel(user_id=uuid4(),
                                              name=f'Category {i}{i}{i}',
                                              description=f'Category description {i}{i}{i}',
                                              type=CategoryType.GENERAL,
                                              status=EntityStatusType.ACTIVE)
        await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    request = CategorySearch(search_term='nothing')

    # When
    categories: Page[Category] = await category_service.get_categories(db=db_fixture, request=request,
                                                                       user_id=user_id)

    # Then
    assert categories.total == 0


@pytest.mark.asyncio
async def test_get_category_by_id_correct_data(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    category_create_model = CategoryModel(user_id=user_id,
                                          name=f'Category',
                                          description=f'Category description',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    # When
    category: Category = await category_service.get_category_by_id(db=db_fixture, category_id=category_db.id,
                                                                   user_id=user_id)

    # Then
    assert category is not None
    assert category.id == category_db.id
    assert category.user_id == category_db.user_id
    assert category.name == category_db.name
    assert category.description == category_db.description
    assert category.type == category_db.type
    assert category.status == category_db.status
    assert category.created_at == category_db.created_at
    assert category.updated_at == category_db.updated_at


@pytest.mark.asyncio
async def test_get_category_by_id_incorrect_data(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    category_id = uuid4()

    # When
    with pytest.raises(NotFoundException) as exc:
        await category_service.get_category_by_id(db=db_fixture, category_id=category_id, user_id=user_id)

    # Then
    assert exc.value.message == f'Category not found by user_id #{user_id} and category_id #{category_id}.'


@pytest.mark.asyncio
async def test_update_category_correct_data(db_fixture: AsyncSession, db: AsyncSession):
    # Given
    user_id = uuid4()

    category_create_model = CategoryModel(user_id=user_id,
                                          name=f'Category',
                                          description=f'Category description',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    category_update = CategoryUpdate(name='Category updated',
                                     description='Category description updated',
                                     type=category_db.type)

    # When
    category: Category = await category_service.update_category(db=db, category_id=category_db.id,
                                                                category_update=category_update, user_id=user_id)
    await db.commit()

    # Then
    assert category is not None
    assert category.id == category_db.id
    assert category.user_id == category_db.user_id
    assert category.name == category_update.name
    assert category.description == category_update.description
    assert category.type == category_db.type
    assert category.status == category_db.status
    assert category.created_at == category_db.created_at
    assert category.updated_at != category_db.updated_at


@pytest.mark.asyncio
async def test_update_category_not_found(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    wrong_user_id = uuid4()
    category_id = uuid4()

    category_create_model = CategoryModel(user_id=user_id,
                                          name=f'Category 1',
                                          description=f'Category description',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    category_update = CategoryUpdate(name='Category updated',
                                     description='Category description updated',
                                     type=CategoryType.GENERAL)

    # When
    with pytest.raises(NotFoundException) as exc:
        await category_service.update_category(db=db_fixture, category_id=category_id,
                                               category_update=category_update, user_id=wrong_user_id)

    # Then
    assert exc.value.message == f'Category not found by user_id #{wrong_user_id} and category_id #{category_id}'


@pytest.mark.asyncio
async def test_update_category_double(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    category_create_model = CategoryModel(user_id=user_id,
                                          name=f'Category 1',
                                          description=f'Category description 2',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    category_create_model = CategoryModel(user_id=user_id,
                                          name=f'Category 2',
                                          description=f'Category description 2',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    category_update = CategoryUpdate(name='Category 1',
                                     description='Category description updated',
                                     type=category_db.type)

    # When
    with pytest.raises(IntegrityExistException) as exc:
        await category_service.update_category(db=db_fixture, category_id=category_db.id,
                                               category_update=category_update, user_id=user_id)

    # Then
    assert exc.value.message == (f'Category integrity exception: DETAIL:  Key (user_id, name, status)=({user_id}, '
                                 f'{category_update.name}, ACTIVE) already exists.')


@pytest.mark.asyncio
async def test_delete_category(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    category_create_model = CategoryModel(user_id=user_id,
                                          name=f'Category 2',
                                          description=f'Category description 2',
                                          type=CategoryType.GENERAL,
                                          status=EntityStatusType.ACTIVE)
    category_db: CategoryModel = await category_crud.create(db=db_fixture, obj_in=category_create_model, commit=True)

    # When
    await category_service.delete_category(db=db_fixture, category_id=category_db.id, user_id=user_id)
    await db_fixture.commit()

    # Then
    categories_db: list[CategoryModel] = await category_crud.get_batch(db=db_fixture, user_id=user_id)
    assert len(categories_db) == 1
    assert categories_db[0].status == EntityStatusType.DELETED


@pytest.mark.asyncio
async def test_delete_category_not_found(db_fixture: AsyncSession):
    # Given
    fake_user_id = uuid4()
    fake_category_id = uuid4()

    # When
    with pytest.raises(NotFoundException) as exc:
        await category_service.delete_category(db=db_fixture, category_id=fake_category_id, user_id=fake_user_id)

    # Then
    assert exc.value.message == f'Category not found by user_id #{fake_user_id} and category_id #{fake_category_id}'
