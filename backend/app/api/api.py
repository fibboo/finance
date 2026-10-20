from fastapi import APIRouter

from app.api.endpoints.accounting import account, categories, dictionaries, income_sources, locations, transactions
from app.api.endpoints.user import auth, user
from app.schemas.error_response import responses

api_router = APIRouter(responses=responses)

accounting_router = APIRouter(prefix="/accounting")
accounting_router.include_router(account.router, prefix="/accounts", tags=["Accounts"])
accounting_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
accounting_router.include_router(income_sources.router, prefix="/income_sources", tags=["Income Sources"])
accounting_router.include_router(locations.router, prefix="/locations", tags=["Locations"])
accounting_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])

api_router.include_router(accounting_router)

dictionaries_router = APIRouter(prefix="/dictionaries")
dictionaries_router.include_router(dictionaries.router, prefix="/accounting", tags=["Dictionaries"])

api_router.include_router(dictionaries_router)

user_router = APIRouter(prefix="/user")
user_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
user_router.include_router(user.router, tags=["User"])

api_router.include_router(user_router)
