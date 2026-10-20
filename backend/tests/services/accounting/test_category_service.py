from uuid import UUID, uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.category import category_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.category import Category as CategoryModel
from app.schemas.accounting.category import (
    Category,
    CategoryCreate,
    CategoryCreateRequest,
    CategoryRequest,
    CategoryType,
    CategoryUpdate,
)
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import category_service


async def test_create_category_ok(db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name="Category 1", type=CategoryType.VARIABLE)

    # Act
    category: Category = await category_service.create_category(
        db=db_transaction, create_data=create_data, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert category is not None
    assert category.id is not None
    assert category.user_id == user_id
    assert category.name == create_data.name
    assert category.description == create_data.description
    assert category.type == CategoryType.VARIABLE
    assert category.created_at is not None
    assert category.updated_at is not None


async def test_create_category_with_existing_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name="Category 1", type=CategoryType.VARIABLE)
    await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    # Act
    with pytest.raises(IntegrityException) as exc:
        await category_service.create_category(db=db_transaction, create_data=create_data, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Category integrity error: 23505 on categories.category_unique_user_id_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 1


async def test_create_default_categories(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()

    # Act
    await category_service.create_default_categories(db=db_transaction, user_id=user_id)
    await db_transaction.commit()

    # Assert
    categories_db: list[CategoryModel] = await category_crud.get_batch(db=db, user_id=user_id)
    category_types: dict[str, CategoryType] = {category_db.name: category_db.type for category_db in categories_db}
    assert category_types == {
        "Groceries": CategoryType.VARIABLE,
        "Eating out": CategoryType.VARIABLE,
        "Transport": CategoryType.VARIABLE,
        "Utilities": CategoryType.FIXED,
        "Subscriptions": CategoryType.FIXED,
        "Travel": CategoryType.PERIODIC,
        "Health": CategoryType.PERIODIC,
        "Clothing": CategoryType.PERIODIC,
    }


async def test_get_categories(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    for i in range(3):
        create_data: CategoryCreateRequest = CategoryCreateRequest(name=f"Category {i}", type=CategoryType.VARIABLE)
        await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    request_all_p1 = CategoryRequest(size=2, page=1)
    request_all_p2 = CategoryRequest(size=2, page=2)
    request_search = CategoryRequest(search_term="y 1")
    request_not_found = CategoryRequest(search_term="not found")

    # Act
    categories_all_p1: Page[Category] = await category_service.get_categories(
        db=db, request=request_all_p1, user_id=user_id
    )
    categories_all_p2: Page[Category] = await category_service.get_categories(
        db=db, request=request_all_p2, user_id=user_id
    )
    categories_search: Page[Category] = await category_service.get_categories(
        db=db, request=request_search, user_id=user_id
    )
    categories_not_found: Page[Category] = await category_service.get_categories(
        db=db, request=request_not_found, user_id=user_id
    )

    # Assert
    assert categories_all_p1.total == 3
    assert len(categories_all_p1.items) == 2
    assert categories_all_p1.items[0].name == "Category 0"
    assert categories_all_p1.items[1].name == "Category 1"

    assert categories_all_p2.total == 3
    assert len(categories_all_p2.items) == 1
    assert categories_all_p2.items[0].name == "Category 2"

    assert categories_search.total == 1
    assert len(categories_search.items) == 1
    assert categories_search.items[0].name == "Category 1"

    assert categories_not_found.total == 0
    assert len(categories_not_found.items) == 0


async def test_get_categories_by_types(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    await category_crud.create(
        db=db, obj_in=CategoryCreate(name="Groceries", type=CategoryType.VARIABLE, user_id=user_id), commit=True
    )
    await category_crud.create(
        db=db, obj_in=CategoryCreate(name="Rent", type=CategoryType.FIXED, user_id=user_id), commit=True
    )
    await category_crud.create(
        db=db, obj_in=CategoryCreate(name="Travel", type=CategoryType.PERIODIC, user_id=user_id), commit=True
    )

    request = CategoryRequest(types=[CategoryType.FIXED, CategoryType.PERIODIC])

    # Act
    categories: Page[Category] = await category_service.get_categories(db=db, request=request, user_id=user_id)

    # Assert
    assert categories.total == 2
    assert [category.name for category in categories.items] == ["Rent", "Travel"]
    assert [category.type for category in categories.items] == [CategoryType.FIXED, CategoryType.PERIODIC]


async def test_get_categories_more_than_twenty(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    for i in range(25):
        create_data = CategoryCreate(name=f"Category {i:02}", type=CategoryType.VARIABLE, user_id=user_id)
        await category_crud.create(db=db, obj_in=create_data, commit=True)

    request = CategoryRequest(size=10, page=3)

    # Act
    categories: Page[Category] = await category_service.get_categories(db=db, request=request, user_id=user_id)

    # Assert
    assert categories.total == 25
    assert categories.pages == 3
    assert [category.name for category in categories.items] == [f"Category {i:02}" for i in range(20, 25)]


async def test_get_category_ok(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name="Category 1", type=CategoryType.VARIABLE)
    category_created: Category = await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    # Act
    category: Category = await category_service.get_category(db=db, category_id=category_created.id, user_id=user_id)

    # Assert
    assert category is not None
    assert category.id == category_created.id
    assert category.user_id == category_created.user_id
    assert category.name == category_created.name
    assert category.description == category_created.description
    assert category.created_at == category_created.created_at
    assert category.updated_at == category_created.updated_at


async def test_get_category_not_found(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    category_id = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.get_category(db=db, category_id=category_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": category_id, "user_id": user_id}
    assert exc.value.log_message == f"{CategoryModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_update_category_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    create_data: CategoryCreateRequest = CategoryCreateRequest(name="Category 1", type=CategoryType.VARIABLE)
    category_created: Category = await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    category_update = CategoryUpdate(
        name="Category updated", description="Category description updated", type=CategoryType.FIXED
    )

    # Act
    category: Category = await category_service.update_category(
        db=db_transaction, category_id=category_created.id, update_data=category_update, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert category is not None
    assert category.id == category_created.id
    assert category.user_id == category_created.user_id
    assert category.name == category_update.name
    assert category.description == category_update.description
    assert category.type == CategoryType.FIXED
    assert category.created_at == category_created.created_at
    assert category.updated_at != category_created.updated_at

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 1


async def test_update_category_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    category_id = uuid4()

    category_update = CategoryUpdate(
        name="Category updated", description="Category description updated", type=CategoryType.FIXED
    )

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.update_category(
            db=db_transaction, category_id=category_id, update_data=category_update, user_id=user_id
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": category_id, "user_id": user_id}
    assert exc.value.log_message == f"{CategoryModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 0


async def test_update_category_double(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    create_data_1: CategoryCreateRequest = CategoryCreateRequest(name="Category 1", type=CategoryType.VARIABLE)
    category_created_1: Category = await category_service.create_category(
        db=db, create_data=create_data_1, user_id=user_id
    )

    create_data_2: CategoryCreateRequest = CategoryCreateRequest(name="Category 2", type=CategoryType.VARIABLE)
    await category_service.create_category(db=db, create_data=create_data_2, user_id=user_id)
    await db.commit()

    category_update: CategoryUpdate = CategoryUpdate(
        name="Category 2", description="Category description updated", type=CategoryType.VARIABLE
    )

    # Act
    with pytest.raises(IntegrityException) as exc:
        await category_service.update_category(
            db=db_transaction, category_id=category_created_1.id, update_data=category_update, user_id=user_id
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Entity integrity error"
    assert exc.value.log_message == "Category integrity error: 23505 on categories.category_unique_user_id_name"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[CategoryModel] = (await db.scalars(select(CategoryModel))).all()
    assert len(transactions) == 2


async def test_create_category_with_name_of_deleted_category(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    deleted_category_create_data: dict = {
        "user_id": user_id,
        "name": "Category 1",
        "type": CategoryType.VARIABLE,
        "status": EntityStatusType.DELETED,
    }
    deleted_category_db: CategoryModel = await category_crud.create(
        db=db, obj_in=deleted_category_create_data, commit=True
    )

    create_data: CategoryCreateRequest = CategoryCreateRequest(name="Category 1", type=CategoryType.FIXED)

    # Act
    category: Category = await category_service.create_category(
        db=db_transaction, create_data=create_data, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert category.id != deleted_category_db.id
    assert category.name == create_data.name
    assert category.status == EntityStatusType.ACTIVE

    categories_db: list[CategoryModel] = (
        await db.scalars(select(CategoryModel).where(CategoryModel.name == create_data.name))
    ).all()
    assert sorted(category_db.status for category_db in categories_db) == [
        EntityStatusType.ACTIVE,
        EntityStatusType.DELETED,
    ]


async def test_get_categories_without_deleted(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    active_category_create_data: dict = {"user_id": user_id, "name": "Active", "type": CategoryType.VARIABLE}
    await category_crud.create(db=db, obj_in=active_category_create_data, commit=True)

    deleted_category_create_data: dict = {
        "user_id": user_id,
        "name": "Deleted",
        "type": CategoryType.VARIABLE,
        "status": EntityStatusType.DELETED,
    }
    await category_crud.create(db=db, obj_in=deleted_category_create_data, commit=True)

    request: CategoryRequest = CategoryRequest()

    # Act
    categories: Page[Category] = await category_service.get_categories(db=db, request=request, user_id=user_id)

    # Assert
    assert categories.total == 1
    assert [category.name for category in categories.items] == ["Active"]


async def test_get_category_deleted(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    category_create_data: dict = {
        "user_id": user_id,
        "name": "Category 1",
        "type": CategoryType.VARIABLE,
        "status": EntityStatusType.DELETED,
    }
    category_db: CategoryModel = await category_crud.create(db=db, obj_in=category_create_data, commit=True)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.get_category(db=db, category_id=category_db.id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_update_category_deleted(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    category_create_data: dict = {
        "user_id": user_id,
        "name": "Category 1",
        "type": CategoryType.VARIABLE,
        "status": EntityStatusType.DELETED,
    }
    category_db: CategoryModel = await category_crud.create(db=db, obj_in=category_create_data, commit=True)

    category_update: CategoryUpdate = CategoryUpdate(name="Category updated", type=CategoryType.FIXED)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.update_category(
            db=db_transaction, category_id=category_db.id, update_data=category_update, user_id=user_id
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    category_db_after: CategoryModel = await category_crud.get(db=db, id=category_db.id)
    assert category_db_after.name == "Category 1"
    assert category_db_after.type == CategoryType.VARIABLE


async def test_delete_category_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    category_create_data: dict = {"user_id": user_id, "name": "Category 1", "type": CategoryType.VARIABLE}
    category_db: CategoryModel = await category_crud.create(db=db, obj_in=category_create_data, commit=True)

    # Act
    category: Category = await category_service.delete_category(
        db=db_transaction, category_id=category_db.id, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert category.id == category_db.id
    assert category.status == EntityStatusType.DELETED

    await db.refresh(category_db)
    assert category_db.status == EntityStatusType.DELETED


async def test_delete_category_of_other_user(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    category_create_data: dict = {"user_id": uuid4(), "name": "Category 1", "type": CategoryType.VARIABLE}
    category_db: CategoryModel = await category_crud.create(db=db, obj_in=category_create_data, commit=True)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.delete_category(db=db_transaction, category_id=category_db.id, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": category_db.id, "user_id": user_id}
    assert exc.value.log_message == f"{CategoryModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    category_db_after: CategoryModel = await category_crud.get(db=db, id=category_db.id)
    assert category_db_after.status == EntityStatusType.ACTIVE


async def test_delete_category_already_deleted(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    category_create_data: dict = {
        "user_id": user_id,
        "name": "Category 1",
        "type": CategoryType.VARIABLE,
        "status": EntityStatusType.DELETED,
    }
    category_db: CategoryModel = await category_crud.create(db=db, obj_in=category_create_data, commit=True)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await category_service.delete_category(db=db_transaction, category_id=category_db.id, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
