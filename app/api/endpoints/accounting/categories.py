from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_db_transaction, get_user_id
from app.schemas.accounting.category import Category, CategoryCreateRequest, CategoryRequest, CategoryUpdate
from app.services.accounting import category_service

router = APIRouter()


@router.post('')
async def create_category(create_data: CategoryCreateRequest,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db_transaction)) -> Category:
    category: Category = await category_service.create_category(db=db,
                                                                create_data=create_data,
                                                                user_id=user_id)
    return category


@router.get('')
async def get_categories(request: CategoryRequest = Depends(),
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)) -> Page[Category]:
    categories: Page[Category] = await category_service.get_categories(db=db,
                                                                       request=request,
                                                                       user_id=user_id)
    return categories


@router.get('/{category_id}')
async def get_category_by_id(category_id: UUID,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db)) -> Category:
    category: Category = await category_service.get_category(db=db, category_id=category_id, user_id=user_id)
    return category


@router.put('/{category_id}')
async def update_category(category_id: UUID,
                          update_data: CategoryUpdate,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db_transaction)) -> Category:
    category: Category = await category_service.update_category(db=db,
                                                                category_id=category_id,
                                                                update_data=update_data,
                                                                user_id=user_id)
    return category
