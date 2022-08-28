from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.api_v1.deps import verify_user
from app.schemas.expense.expense import Expense, ExpenseCreate, ExpenseUpdate, ExpenseRequest
from app.schemas.user.user import UserSession
from app.services.expense import expense_service

router = APIRouter()


@router.post('', response_model=Expense)
async def create_expense(expense_create: ExpenseCreate, user_session: UserSession = Depends(verify_user)):
    expanse: Expense = await expense_service.create_expense(expense_create=expense_create, user_id=user_session.user.id)
    return expanse


@router.post('/list', response_model=list[Expense])
async def get_expenses(request: ExpenseRequest,
                       user_session: UserSession = Depends(verify_user)):
    expanse: list[Expense] = await expense_service.get_expenses(request=request, user_id=user_session.user.id)
    return expanse


@router.get('/{expense_id}', response_model=Expense)
async def get_expense_by_id(expense_id: UUID,
                            user_session: UserSession = Depends(verify_user)):
    expanse: Expense = await expense_service.get_expense_by_id(expense_id=expense_id, user_id=user_session.user.id)
    return expanse


@router.put('/update', response_model=Expense)
async def update_expense(expense_update: ExpenseUpdate,
                         user_session: UserSession = Depends(verify_user)):
    expanse: Expense = await expense_service.update_expense(expense_update=expense_update, user_id=user_session.user.id)
    return expanse


@router.delete('/{expense_id}', status_code=200)
async def delete_expense(expense_id: UUID,
                         user_session: UserSession = Depends(verify_user)):
    await expense_service.delete_expense(expense_id=expense_id, user_id=user_session.user.id)
