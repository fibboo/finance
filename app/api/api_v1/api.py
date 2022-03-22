from fastapi import APIRouter

from app.api.api_v1.endpoints import expenses, incomes

api_router = APIRouter()
api_router.include_router(expenses.router, prefix='/api/expenses', tags=['Expenses'])
api_router.include_router(incomes.router, prefix='/api/incomes', tags=['Incomes'])
