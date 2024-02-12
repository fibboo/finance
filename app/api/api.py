from fastapi import APIRouter

from app.api.endpoints import income
from app.api.endpoints.expense import category, location
from app.api.endpoints.expense import expense

api_router = APIRouter()
api_router.include_router(expense.router, prefix='/expense', tags=['Expense'])
api_router.include_router(category.router, prefix='/expense/category', tags=['Category'])
api_router.include_router(location.router, prefix='/expense/location', tags=['Location'])
api_router.include_router(income.router, prefix='/income', tags=['Income'])
