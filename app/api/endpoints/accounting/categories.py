from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_db, get_onboarded_user_id, get_user_id
from app.schemas.accounting.category import Category, CategoryCreateRequest, CategoryRequest, CategoryUpdate
from app.services.accounting import category_service

router = APIRouter()


@router.post("")
async def create_category(
    *,
    create_data: CategoryCreateRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Category:
    category: Category = await category_service.create_category(db=db, create_data=create_data, user_id=user_id)
    return category


@router.get("")
async def get_categories(
    *, request: CategoryRequest = Depends(), user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> Page[Category]:
    categories: Page[Category] = await category_service.get_categories(db=db, request=request, user_id=user_id)
    return categories


@router.get("/{category_id}")
async def get_category_by_id(
    *, category_id: UUID, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> Category:
    category: Category = await category_service.get_category(db=db, category_id=category_id, user_id=user_id)
    return category


@router.put("/{category_id}")
async def update_category(
    *,
    category_id: UUID,
    update_data: CategoryUpdate,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Category:
    category: Category = await category_service.update_category(
        db=db, category_id=category_id, update_data=update_data, user_id=user_id
    )
    return category


@router.delete("/{category_id}")
async def delete_category(*, category_id: UUID, user_id: UUID = Depends(get_user_id), db: DbTransaction) -> Category:
    """
    Deleted category is hidden from the list and cannot be used by a new expense; existing expenses keep it
    """
    category: Category = await category_service.delete_category(db=db, category_id=category_id, user_id=user_id)
    return category
