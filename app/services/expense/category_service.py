from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.expense.category import category_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.expense.category import Category as CategoryModel
from app.schemas.base import EntityStatusType
from app.schemas.expense.category import Category, CategoryCreate, CategorySearch, CategoryUpdate

logger = get_logger(__name__)


async def create_category(db: AsyncSession, category_create: CategoryCreate, user_id: UUID) -> Category:
    obj_in: CategoryModel = CategoryModel(**category_create.model_dump(),
                                          user_id=user_id,
                                          status=EntityStatusType.ACTIVE)
    try:
        expense_db: CategoryModel = await category_crud.create(db=db, obj_in=obj_in)

    except IntegrityError as exc:
        raise IntegrityException(entity=CategoryModel, exception=exc, logger=logger)

    category: Category = Category.model_validate(expense_db)
    return category


async def get_categories(db: AsyncSession, request: CategorySearch, user_id: UUID) -> Page[Category]:
    categories_db: Page[CategoryModel] = await category_crud.get_categories(db=db, request=request, user_id=user_id)
    categories: Page[Category] = Page[Category].model_validate(categories_db)
    return categories


async def get_category_by_id(db: AsyncSession, category_id: UUID, user_id: UUID) -> Category:
    category_db: CategoryModel | None = await category_crud.get_or_none(db=db, id=category_id, user_id=user_id)

    if category_db is None:
        raise EntityNotFound(entity=CategoryModel, search_params={'id': category_id, 'user_id': user_id}, logger=logger)

    category: Category = Category.model_validate(category_db)
    return category


async def update_category(db: AsyncSession, category_id: UUID, category_update: CategoryUpdate,
                          user_id: UUID) -> Category:
    try:
        category_db: CategoryModel | None = await category_crud.update(db=db,
                                                                       id=category_id,
                                                                       obj_in=category_update,
                                                                       user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=CategoryModel, exception=exc, logger=logger)

    if category_db is None:
        raise EntityNotFound(entity=CategoryModel, search_params={'id': category_id, 'user_id': user_id}, logger=logger)

    category: Category = Category.model_validate(category_db)
    return category


async def delete_category(db: AsyncSession, category_id: UUID, user_id: UUID) -> None:
    delete_update_data = {'status': EntityStatusType.DELETED}
    try:
        category_db: CategoryModel | None = await category_crud.update(db=db,
                                                                       id=category_id,
                                                                       obj_in=delete_update_data,
                                                                       user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=CategoryModel, exception=exc, logger=logger)

    if category_db is None:
        raise EntityNotFound(entity=CategoryModel, search_params={'id': category_id, 'user_id': user_id}, logger=logger)
