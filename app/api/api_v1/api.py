from fastapi import APIRouter

from app.api.api_v1.endpoints import income
from app.api.api_v1.endpoints.expense import expense, expense_category, expense_place

api_router = APIRouter()
api_router.include_router(expense.router, prefix='/expense', tags=['Expense'])
api_router.include_router(expense_category.router, prefix='/expense/category', tags=['Expense Category'])
api_router.include_router(expense_place.router, prefix='/expense/place', tags=['Expense Place'])
api_router.include_router(income.router, prefix='/income', tags=['Income'])
