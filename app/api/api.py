from fastapi import APIRouter

from app.api.endpoints.expense import category, location
from app.api.endpoints.expense import expense
from app.api.endpoints.user import auth

api_router = APIRouter()

# Expense
api_router.include_router(expense.router, prefix='/expense', tags=['Expense'])
api_router.include_router(category.router, prefix='/expense/category', tags=['Category'])
api_router.include_router(location.router, prefix='/expense/location', tags=['Location'])

# User
api_router.include_router(auth.router, prefix='/user/auth', tags=['Auth'])
