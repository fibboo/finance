from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.api_v1.deps import get_db
from app.exceptions.exception import ProcessingException
from app.schemas.base import EntityStatusType
from app.schemas.expense.expense_place import ExpensePlace, ExpensePlaceCreate, ExpensePlaceUpdate, ExpensePlaceRequest
from app.services.expense import exp_place_service

router = APIRouter()


@router.post('', response_model=ExpensePlace)
def create_expense_place(expense_place_create: ExpensePlaceCreate, db: Session = Depends(get_db)):
    expense_place: ExpensePlace = exp_place_service.create_expense_place(db=db,
                                                                         expense_place_create=expense_place_create)
    return expense_place


@router.post('/search', response_model=list[ExpensePlace])
def search_expense_places(request: ExpensePlaceRequest, db: Session = Depends(get_db)):
    expense_places: list[ExpensePlace] = exp_place_service.search_expense_places(db=db, request=request)

    return expense_places


@router.get('/{expense_place_id}', response_model=ExpensePlace)
def get_expense_place_by_id(expense_place_id: int, db: Session = Depends(get_db)):
    expense_place: ExpensePlace = exp_place_service.get_expense_place_by_id(db=db,
                                                                            expense_place_id=expense_place_id)
    return expense_place


@router.put('/{expense_place_id}', response_model=ExpensePlace)
def update_expense_place(expense_place_id: int,
                         expense_place_update: ExpensePlaceUpdate,
                         db: Session = Depends(get_db)):
    expense_place: ExpensePlace = exp_place_service.update_expense_place(db=db,
                                                                         expense_place_id=expense_place_id,
                                                                         expense_place_update=expense_place_update)
    return expense_place


@router.put('/status/{expense_place_id}/{status}', response_model=ExpensePlace)
def update_expense_place_status(expense_place_id: int, status: EntityStatusType, db: Session = Depends(get_db)):
    match status:
        case EntityStatusType.ACTIVE:
            expense_place: ExpensePlace = exp_place_service.update_expense_place_status(db=db,
                                                                                        expense_place_id=expense_place_id,
                                                                                        status=status)
        case EntityStatusType.DELETED:
            expense_place: ExpensePlace = exp_place_service.update_expense_place_status(db=db,
                                                                                        expense_place_id=expense_place_id,
                                                                                        status=status)
        case _:
            raise ProcessingException(f'Invalid entity status type: {status}')

    return expense_place
