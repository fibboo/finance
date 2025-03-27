from uuid import UUID, uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.category import Category as CategoryModel
from app.schemas.accounting.category import (Category, CategoryCreateRequest, CategoryRequest, CategoryType,
                                             CategoryUpdate)
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import category_service


@pytest.mark.asyncio
async def test_create_category_ok(db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name='Category 1', type=CategoryType.GENERAL)

    # Act
    category: Category = await category_service.create_category(db=db_transaction, create_data=create_data,
                                                                user_id=user_id)
    await db_transaction.commit()

    # Assert
    assert category is not None
    assert category.id is not None
    assert category.user_id == user_id
    assert category.name == create_data.name
    assert category.description == create_data.description
    assert category.type == create_data.type
    assert category.created_at is not None
    assert category.updated_at is not None


@pytest.mark.asyncio
async def test_create_category_with_existing_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name='Category 1', type=CategoryType.GENERAL)
    await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    # Act
    with pytest.raises(IntegrityException) as exc:
        await category_service.create_category(db=db_transaction, create_data=create_data, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == 'Entity integrity error'
    assert exc.value.log_message == (f'Category integrity error: DETAIL:  Key (user_id, name)=({user_id}, '
                                     f'{create_data.name}) already exists.')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 1


@pytest.mark.asyncio
async def test_get_categories(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    for i in range(3):
        category_type = CategoryType.GENERAL if i % 2 == 0 else CategoryType.TARGET
        create_data: CategoryCreateRequest = CategoryCreateRequest(name=f'Category {i}', type=category_type)
        await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    request_all_p1 = CategoryRequest(size=2, page=1)
    request_all_p2 = CategoryRequest(size=2, page=2)
    request_search = CategoryRequest(search_term='y 1')
    request_type = CategoryRequest(types=[CategoryType.GENERAL])
    request_not_found = CategoryRequest(search_term='not found')

    # Act
    categories_all_p1: Page[Category] = await category_service.get_categories(db=db, request=request_all_p1,
                                                                              user_id=user_id)
    categories_all_p2: Page[Category] = await category_service.get_categories(db=db, request=request_all_p2,
                                                                              user_id=user_id)
    categories_search: Page[Category] = await category_service.get_categories(db=db, request=request_search,
                                                                              user_id=user_id)
    categories_type: Page[Category] = await category_service.get_categories(db=db, request=request_type,
                                                                            user_id=user_id)
    categories_not_found: Page[Category] = await category_service.get_categories(db=db,
                                                                                 request=request_not_found,
                                                                                 user_id=user_id)

    # Assert
    assert categories_all_p1.total == 3
    assert len(categories_all_p1.items) == 2
    assert categories_all_p1.items[0].name == 'Category 0'
    assert categories_all_p1.items[1].name == 'Category 1'

    assert categories_all_p2.total == 3
    assert len(categories_all_p2.items) == 1
    assert categories_all_p2.items[0].name == 'Category 2'

    assert categories_search.total == 1
    assert len(categories_search.items) == 1
    assert categories_search.items[0].name == 'Category 1'

    assert categories_type.total == 2
    assert len(categories_type.items) == 2
    assert categories_type.items[0].name == 'Category 0'
    assert categories_type.items[0].type == request_type.types[0]
    assert categories_type.items[1].name == 'Category 2'
    assert categories_type.items[1].type == request_type.types[0]

    assert categories_not_found.total == 0
    assert len(categories_not_found.items) == 0


@pytest.mark.asyncio
async def test_get_category_ok(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name='Category 1', type=CategoryType.GENERAL)
    category_created: Category = await category_service.create_category(db=db, create_data=create_data,
                                                                        user_id=user_id)
    await db.commit()

    # Act
    category: Category = await category_service.get_category(db=db, category_id=category_created.id,
                                                             user_id=user_id)

    # Assert
    assert category is not None
    assert category.id == category_created.id
    assert category.user_id == category_created.user_id
    assert category.name == category_created.name
    assert category.description == category_created.description
    assert category.type == category_created.type
    assert category.created_at == category_created.created_at
    assert category.updated_at == category_created.updated_at


@pytest.mark.asyncio
async def test_get_category_not_found(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    category_id = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.get_category(db=db, category_id=category_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == 'Entity not found'
    search_params = {'id': category_id, 'user_id': user_id}
    assert exc.value.log_message == f'{CategoryModel.__name__} not found by {search_params}'
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_update_category_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name='Category 1', type=CategoryType.GENERAL)
    category_created: Category = await category_service.create_category(db=db, create_data=create_data,
                                                                        user_id=user_id)
    await db.commit()

    category_update = CategoryUpdate(name='Category updated',
                                     description='Category description updated',
                                     type=category_created.type)

    # Act
    category: Category = await category_service.update_category(db=db_transaction, category_id=category_created.id,
                                                                update_data=category_update, user_id=user_id)
    await db_transaction.commit()

    # Assert
    assert category is not None
    assert category.id == category_created.id
    assert category.user_id == category_created.user_id
    assert category.name == category_update.name
    assert category.description == category_update.description
    assert category.type == category_created.type
    assert category.created_at == category_created.created_at
    assert category.updated_at != category_created.updated_at

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 1


@pytest.mark.asyncio
async def test_update_category_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    category_id = uuid4()

    category_update = CategoryUpdate(name='Category updated',
                                     description='Category description updated',
                                     type=CategoryType.GENERAL)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.update_category(db=db_transaction, category_id=category_id,
                                               update_data=category_update, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == 'Entity not found'
    search_params = {'id': category_id, 'user_id': user_id}
    assert exc.value.log_message == f'{CategoryModel.__name__} not found by {search_params}'
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 0


@pytest.mark.asyncio
async def test_update_category_double(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    create_data_1: CategoryCreateRequest = CategoryCreateRequest(name='Category 1', type=CategoryType.GENERAL)
    category_created_1: Category = await category_service.create_category(db=db, create_data=create_data_1,
                                                                          user_id=user_id)

    create_data_2: CategoryCreateRequest = CategoryCreateRequest(name='Category 2', type=CategoryType.GENERAL)
    await category_service.create_category(db=db, create_data=create_data_2,
                                           user_id=user_id)
    await db.commit()

    category_update: CategoryUpdate = CategoryUpdate(name='Category 2',
                                                     description='Category description updated',
                                                     type=category_created_1.type)

    # Act
    with pytest.raises(IntegrityException) as exc:
        await category_service.update_category(db=db_transaction, category_id=category_created_1.id,
                                               update_data=category_update, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == 'Entity integrity error'
    assert exc.value.log_message == (f'Category integrity error: DETAIL:  Key (user_id, name)=({user_id}, '
                                     f'{category_update.name}) already exists.')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 2
