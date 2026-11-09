from fastapi import APIRouter

from app.api.endpoints.accounting import (
    account,
    currencies,
    dictionaries as accounting_dictionaries,
    locations,
    summary,
    transactions,
)
from app.api.endpoints.user import auth, dictionaries as user_dictionaries, user
from app.schemas.error_response import responses

api_router = APIRouter(responses=responses)

accounting_router = APIRouter(prefix="/accounting")
accounting_router.include_router(account.router, prefix="/accounts", tags=["Accounts"])
accounting_router.include_router(currencies.router, prefix="/currencies", tags=["Currencies"])
accounting_router.include_router(locations.router, prefix="/locations", tags=["Locations"])
accounting_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
accounting_router.include_router(summary.router, prefix="/summary", tags=["Summary"])

api_router.include_router(accounting_router)

dictionaries_router = APIRouter(prefix="/dictionaries")
dictionaries_router.include_router(accounting_dictionaries.router, prefix="/accounting", tags=["Dictionaries"])
dictionaries_router.include_router(user_dictionaries.router, prefix="/user", tags=["Dictionaries"])

api_router.include_router(dictionaries_router)

user_router = APIRouter(prefix="/user")
user_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
user_router.include_router(user.router, tags=["User"])

api_router.include_router(user_router)
