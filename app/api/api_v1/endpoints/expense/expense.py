from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.api_v1.deps import get_db
from app.schemas.expense.expense import Expense, ExpenseCreate, ExpenseUpdate, ExpenseRequest
from app.services.expense import expense_service

router = APIRouter()


@router.post('', response_model=Expense)
def create_expense(expense_create: ExpenseCreate, db: Session = Depends(get_db)):
    expanse: Expense = expense_service.create_expense(db=db, expense_create=expense_create)
    return expanse


@router.post('/list', response_model=list[Expense])
def get_expenses(request: ExpenseRequest = Depends(), db: Session = Depends(get_db)):
    expanse: list[Expense] = expense_service.get_expenses(db=db, request=request)
    return expanse


@router.get('/{expense_id}', response_model=Expense)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    expanse: Expense = expense_service.get_expense(db=db, expense_id=expense_id)
    return expanse


@router.put('/{expense_id}', response_model=Expense)
def update_expense(expense_id: int, expense_update: ExpenseUpdate, db: Session = Depends(get_db)):
    expanse: Expense = expense_service.update_expense(db=db, expense_id=expense_id, expense_update=expense_update)
    return expanse


@router.delete('/{expense_id}', status_code=200)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense_service.delete_expense(db=db, expense_id=expense_id)
