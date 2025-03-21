from fastapi import APIRouter

from app.api.endpoints.accounting import account, categories, income_sources, locations, transactions
from app.api.endpoints.user import auth

api_router = APIRouter()

# Accounting
accounting_router = APIRouter(prefix='/accounting')
accounting_router.include_router(account.router, prefix='/accounts', tags=['Account'])
accounting_router.include_router(categories.router, prefix='/categories', tags=['Category'])
accounting_router.include_router(income_sources.router, prefix='/income_sources', tags=['Income Source'])
accounting_router.include_router(locations.router, prefix='/locations', tags=['Location'])
accounting_router.include_router(transactions.router, prefix='/transactions', tags=['Transaction'])

api_router.include_router(accounting_router)

# User
user_router = APIRouter(prefix='/user')
user_router.include_router(auth.router, prefix='/auth', tags=['Auth'])

api_router.include_router(user_router)
