from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id, get_db
from app.schemas.expense.expense import Expense, ExpenseCreate, ExpenseUpdate, ExpenseRequest
from app.services.expense import expense_service

router = APIRouter()


@router.post('', response_model=Expense)
async def create_expense(expense_create: ExpenseCreate,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)):
    expanse: Expense = await expense_service.create_expense(db=db, expense_create=expense_create, user_id=user_id)
    return expanse


@router.post('/list', response_model=list[Expense])
async def get_expenses(body: ExpenseRequest,
                       user_id: UUID = Depends(get_user_id),
                       db: AsyncSession = Depends(get_db)):
    expanse: Page[Expense] = await expense_service.get_expenses(db=db, request=body, user_id=user_id)
    return expanse


@router.get('/{expense_id}', response_model=Expense)
async def get_expense_by_id(expense_id: UUID,
                            user_id: UUID = Depends(get_user_id),
                            db: AsyncSession = Depends(get_db)):
    expanse: Expense = await expense_service.get_expense_by_id(db=db, expense_id=expense_id, user_id=user_id)
    return expanse


@router.put('/{expense_id}', response_model=Expense)
async def update_expense(expense_id: UUID,
                         expense_update: ExpenseUpdate,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)):
    expanse: Expense = await expense_service.update_expense(db=db,
                                                            expense_id=expense_id,
                                                            expense_update=expense_update,
                                                            user_id=user_id)
    return expanse


@router.delete('/{expense_id}', status_code=200)
async def delete_expense(expense_id: UUID,
                         user_id: UUID = Depends(get_user_id),
                         db: AsyncSession = Depends(get_db)):
    await expense_service.delete_expense(db=db, expense_id=expense_id, user_id=user_id)
