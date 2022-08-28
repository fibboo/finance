from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.api_v1.deps import verify_user
from app.schemas.expense.expense_category import (ExpenseCategory, ExpenseCategoryCreate, ExpenseCategoryUpdate,
                                                  ExpenseCategorySearch, ExpenseCategoryUpdateStatus)
from app.schemas.user.user import UserSession
from app.services.expense import category_service

router = APIRouter()


@router.post('', response_model=ExpenseCategory)
async def create_expense_category(category_create: ExpenseCategoryCreate,
                                  user_session: UserSession = Depends(verify_user)):
    expense_category: ExpenseCategory = await category_service.create_expense_category(category_create=category_create,
                                                                                       user_id=user_session.user.id)
    return expense_category


@router.post('/search', response_model=list[ExpenseCategory])
async def search_expense_categories(request: ExpenseCategorySearch,
                                    user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_categories: list[ExpenseCategory] = await category_service.search_expense_categories(request=request,
                                                                                                 user_id=user_id)
    return expense_categories


@router.get('/{category_id}', response_model=ExpenseCategory)
async def get_expense_category_by_id(category_id: UUID,
                                     user_session: UserSession = Depends(verify_user)):
    expense_category: ExpenseCategory = await category_service.get_expense_category_by_id(category_id=category_id,
                                                                                          user_id=user_session.user.id)
    return expense_category


@router.put('/update', response_model=ExpenseCategory)
async def update_expense_category(request: ExpenseCategoryUpdate,
                                  user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_category: ExpenseCategory = await category_service.update_expense_category(request=request, user_id=user_id)
    return expense_category


@router.put('/update-status', response_model=ExpenseCategory)
async def update_expense_category_status(request: ExpenseCategoryUpdateStatus,
                                         user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_category: ExpenseCategory = await category_service.update_expense_category_status(request=request,
                                                                                              user_id=user_id)
    return expense_category
