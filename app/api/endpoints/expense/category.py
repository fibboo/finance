from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id, get_db_transaction
from app.schemas.expense.category import Category, CategoryCreate, CategoryUpdate, CategorySearch
from app.services.expense import category_service

router = APIRouter()


@router.post('', response_model=Category)
async def create_category(category_create: CategoryCreate,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db_transaction)):
    category: Category = await category_service.create_category(db=db,
                                                                category_create=category_create,
                                                                user_id=user_id)
    return category


@router.post('/list', response_model=Page[Category])
async def get_categories(body: CategorySearch,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db_transaction)):
    categories: Page[Category] = await category_service.get_categories(db=db, request=body, user_id=user_id)
    return categories


@router.get('/{category_id}', response_model=Category)
async def get_category_by_id(category_id: UUID,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)):
    category: Category = await category_service.get_category_by_id(db=db, category_id=category_id, user_id=user_id)
    return category


@router.put('/{category_id}', response_model=Category)
async def update_expense_category(category_id: UUID,
                                  category_update: CategoryUpdate,
                                  user_id: UUID = Depends(get_user_id),
                                  db: AsyncSession = Depends(get_db_transaction)):
    category: Category = await category_service.update_category(db=db,
                                                                category_id=category_id,
                                                                category_update=category_update,
                                                                user_id=user_id)
    return category


@router.delete('/{category_id}', status_code=200)
async def delete_category(category_id: UUID,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db_transaction)):
    await category_service.delete_category(db=db, expense_id=category_id, user_id=user_id)
