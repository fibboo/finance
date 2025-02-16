from fastapi import APIRouter

from app.api.endpoints.transaction import account, categories, locations, transactions
from app.api.endpoints.user import auth

api_router = APIRouter()

# Transactions
api_router.include_router(account.router, prefix='/accounts', tags=['Account'])
api_router.include_router(categories.router, prefix='/categories', tags=['Category'])
api_router.include_router(locations.router, prefix='/locations', tags=['Location'])
api_router.include_router(transactions.router, prefix='/transactions', tags=['Transaction'])

# User
api_router.include_router(auth.router, prefix='/user/auth', tags=['Auth'])
