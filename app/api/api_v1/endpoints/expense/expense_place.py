from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.api_v1.deps import verify_user
from app.schemas.expense.expense_place import (ExpensePlace, ExpensePlaceCreate, ExpensePlaceUpdate, ExpensePlaceSearch,
                                               ExpensePlaceUpdateStatus)
from app.schemas.user.user import UserSession
from app.services.expense import place_service

router = APIRouter()


@router.post('', response_model=ExpensePlace)
async def create_expense_place(place_create: ExpensePlaceCreate,
                               user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_place: ExpensePlace = await place_service.create_expense_place(place_create=place_create, user_id=user_id)
    return expense_place


@router.post('/search', response_model=list[ExpensePlace])
async def search_expense_places(request: ExpensePlaceSearch,
                                user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_places: list[ExpensePlace] = await place_service.search_expense_places(request=request, user_id=user_id)

    return expense_places


@router.get('/{place_id}', response_model=ExpensePlace)
async def get_expense_place_by_id(place_id: UUID,
                                  user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_place: ExpensePlace = await place_service.get_expense_place_by_id(place_id=place_id, user_id=user_id)
    return expense_place


@router.put('/update', response_model=ExpensePlace)
async def update_expense_place(request: ExpensePlaceUpdate,
                               user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_place: ExpensePlace = await place_service.update_expense_place(request=request, user_id=user_id)
    return expense_place


@router.put('/update-status', response_model=ExpensePlace)
async def update_expense_place_status(request: ExpensePlaceUpdateStatus,
                                      user_session: UserSession = Depends(verify_user)):
    user_id = user_session.user.id
    expense_place: ExpensePlace = await place_service.update_expense_place_status(request=request, user_id=user_id)
    return expense_place
