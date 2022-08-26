from uuid import UUID

from fastapi import APIRouter

from app.schemas.expense.expense_place import (ExpensePlace, ExpensePlaceCreate, ExpensePlaceUpdate, ExpensePlaceSearch,
                                               ExpensePlaceUpdateStatus)
from app.services.expense import place_service

router = APIRouter()


@router.post('', response_model=ExpensePlace)
async def create_expense_place(expense_place_create: ExpensePlaceCreate):
    expense_place: ExpensePlace = await place_service.create_expense_place(expense_place_create=expense_place_create)
    return expense_place


@router.post('/search', response_model=list[ExpensePlace])
async def search_expense_places(request: ExpensePlaceSearch):
    expense_places: list[ExpensePlace] = await place_service.search_expense_places(request=request)

    return expense_places


@router.get('/{expense_place_id}', response_model=ExpensePlace)
async def get_expense_place_by_id(expense_place_id: UUID):
    expense_place: ExpensePlace = await place_service.get_expense_place_by_id(expense_place_id=expense_place_id)
    return expense_place


@router.put('/update', response_model=ExpensePlace)
async def update_expense_place(request: ExpensePlaceUpdate):
    expense_place: ExpensePlace = await place_service.update_expense_place(request=request)
    return expense_place


@router.put('/update-status', response_model=ExpensePlace)
async def update_expense_place_status(request: ExpensePlaceUpdateStatus):
    expense_place: ExpensePlace = await place_service.update_expense_place_status(request=request)
    return expense_place
