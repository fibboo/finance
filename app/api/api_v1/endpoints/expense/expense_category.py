from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.api_v1.deps import get_db
from app.exceptions.exception import ProcessingException
from app.schemas.base import EntityStatusType
from app.schemas.expense.expense_category import (ExpenseCategory, ExpenseCategoryCreate, ExpenseCategoryUpdate,
                                                  ExpenseCategoryRequest)
from app.services.expense import exp_category_service

router = APIRouter()


@router.post('', response_model=ExpenseCategory)
def create_expense_category(expense_cat_create: ExpenseCategoryCreate, db: Session = Depends(get_db)):
    expense_category: ExpenseCategory = exp_category_service.create_expense_category(db=db,
                                                                                     expense_cat_create=expense_cat_create)
    return expense_category


@router.post('/search', response_model=list[ExpenseCategory])
def search_expense_categories(request: ExpenseCategoryRequest, db: Session = Depends(get_db)):
    expense_categories: list[ExpenseCategory] = exp_category_service.search_expense_categories(db=db, request=request)
    return expense_categories


@router.get('/{expense_cat_id}', response_model=ExpenseCategory)
def get_expense_category_by_id(expense_cat_id: int, db: Session = Depends(get_db)):
    expense_category: ExpenseCategory = exp_category_service.get_expense_category_by_id(db=db,
                                                                                        expense_cat_id=expense_cat_id)
    return expense_category


@router.put('/{expense_cat_id}', response_model=ExpenseCategory)
def update_expense_category(expense_cat_id: int,
                            expense_cat_update: ExpenseCategoryUpdate,
                            db: Session = Depends(get_db)):
    expense_category: ExpenseCategory = exp_category_service.update_expense_category(db=db,
                                                                                     expense_cat_id=expense_cat_id,
                                                                                     expense_cat_update=expense_cat_update)
    return expense_category


@router.put('/status/{expense_cat_id}/{status}', response_model=ExpenseCategory)
def update_expense_category_status(expense_cat_id: int, status: EntityStatusType, db: Session = Depends(get_db)):
    match status:
        case EntityStatusType.ACTIVE:
            expense_category: ExpenseCategory = exp_category_service.update_expense_category_status(db=db,
                                                                                                    expense_cat_id=expense_cat_id,
                                                                                                    status=status)
        case EntityStatusType.DELETED:
            expense_category: ExpenseCategory = exp_category_service.update_expense_category_status(db=db,
                                                                                                    expense_cat_id=expense_cat_id,
                                                                                                    status=status)
        case _:
            raise ProcessingException(f'Invalid entity status type: {status}')

    return expense_category
