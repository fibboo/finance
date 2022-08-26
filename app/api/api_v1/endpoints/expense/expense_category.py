from uuid import UUID

from fastapi import APIRouter

from app.schemas.expense.expense_category import (ExpenseCategory, ExpenseCategoryCreate, ExpenseCategoryUpdate,
                                                  ExpenseCategorySearch, ExpenseCategoryUpdateStatus)
from app.services.expense import category_service

router = APIRouter()


@router.post('', response_model=ExpenseCategory)
async def create_expense_category(expense_cat_create: ExpenseCategoryCreate):
    expense_category: ExpenseCategory = await category_service.create_expense_category(
        expense_cat_create=expense_cat_create)
    return expense_category


@router.post('/search', response_model=list[ExpenseCategory])
async def search_expense_categories(request: ExpenseCategorySearch):
    expense_categories: list[ExpenseCategory] = await category_service.search_expense_categories(request=request)
    return expense_categories


@router.get('/{expense_category_id}', response_model=ExpenseCategory)
async def get_expense_category_by_id(expense_category_id: UUID):
    expense_category: ExpenseCategory = await category_service.get_expense_category_by_id(
        expense_category_id=expense_category_id
    )
    return expense_category


@router.put('/update', response_model=ExpenseCategory)
async def update_expense_category(request: ExpenseCategoryUpdate):
    expense_category: ExpenseCategory = await category_service.update_expense_category(request=request)
    return expense_category


@router.put('/update-status', response_model=ExpenseCategory)
async def update_expense_category_status(request: ExpenseCategoryUpdateStatus):
    expense_category: ExpenseCategory = await category_service.update_expense_category_status(request=request)
    return expense_category
