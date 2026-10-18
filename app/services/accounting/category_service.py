from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
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

logger = get_logger(logger_name=__name__)

DEFAULT_CATEGORIES: frozendict[str, CategoryType] = frozendict(
    {
        "Groceries": CategoryType.VARIABLE,
        "Eating out": CategoryType.VARIABLE,
        "Transport": CategoryType.VARIABLE,
        "Utilities": CategoryType.FIXED,
        "Subscriptions": CategoryType.FIXED,
        "Travel": CategoryType.PERIODIC,
        "Health": CategoryType.PERIODIC,
        "Clothing": CategoryType.PERIODIC,
    }
)


async def create_category(*, db: AsyncSession, create_data: CategoryCreateRequest, user_id: UUID) -> Category:
    obj_in: CategoryCreate = CategoryCreate(**create_data.model_dump(), user_id=user_id)
    try:
        expense_db: CategoryModel = await category_crud.create(db=db, obj_in=obj_in)

    except IntegrityError as exc:
        raise IntegrityException(entity=CategoryModel, exception=exc, logger=logger)

    category: Category = Category.model_validate(expense_db)
    return category


async def create_default_categories(*, db: AsyncSession, user_id: UUID) -> None:
    create_data: list[CategoryCreate] = []
    for name, category_type in DEFAULT_CATEGORIES.items():
        create_data.append(CategoryCreate(name=name, type=category_type, user_id=user_id))

    await category_crud.create_batch(db=db, objs_in=create_data)


async def get_categories(*, db: AsyncSession, request: CategoryRequest, user_id: UUID) -> Page[Category]:
    categories_db: Page[CategoryModel] = await category_crud.get_categories(db=db, request=request, user_id=user_id)
    categories: Page[Category] = Page[Category].model_validate(categories_db)
    return categories


async def get_category(*, db: AsyncSession, category_id: UUID, user_id: UUID) -> Category:
    category_db: CategoryModel | None = await category_crud.get_or_none(
        db=db, id=category_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    if category_db is None:
        raise EntityNotFound(entity=CategoryModel, search_params={"id": category_id, "user_id": user_id}, logger=logger)

    category: Category = Category.model_validate(category_db)
    return category


async def update_category(
    *, db: AsyncSession, category_id: UUID, update_data: CategoryUpdate, user_id: UUID
) -> Category:
    try:
        category_db: CategoryModel | None = await category_crud.update_orm(
            db=db, obj_in=update_data, id=category_id, user_id=user_id, status=EntityStatusType.ACTIVE
        )
    except IntegrityError as exc:
        raise IntegrityException(entity=CategoryModel, exception=exc, logger=logger)

    if category_db is None:
        raise EntityNotFound(entity=CategoryModel, search_params={"id": category_id, "user_id": user_id}, logger=logger)

    category: Category = Category.model_validate(category_db)
    return category


async def delete_category(*, db: AsyncSession, category_id: UUID, user_id: UUID) -> Category:
    category_db: CategoryModel | None = await category_crud.get_or_none(
        db=db, id=category_id, user_id=user_id, status=EntityStatusType.ACTIVE, with_for_update=True
    )
    if category_db is None:
        raise EntityNotFound(entity=CategoryModel, search_params={"id": category_id, "user_id": user_id}, logger=logger)

    obj_in: dict = {"status": EntityStatusType.DELETED.value}
    category_db: CategoryModel = await category_crud.update_orm(
        db=db, obj_in=obj_in, id=category_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )
    category: Category = Category.model_validate(category_db)
    return category
