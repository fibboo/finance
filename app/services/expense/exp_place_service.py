from pydantic import parse_obj_as
from sqlalchemy.orm import Session

from app.crud.expense.expense_place import exp_place_crud
from app.exceptions.exception import NotFoundEntity, ProcessingException
from app.models import ExpensePlace as ExpensePlaceModel
from app.schemas.base import EntityStatusType, EntityStatusUpdate
from app.schemas.expense.expense_place import ExpensePlaceCreate, ExpensePlace, ExpensePlaceUpdate, ExpensePlaceRequest


def create_expense_place(db: Session, expense_place_create: ExpensePlaceCreate) -> ExpensePlace:
    place_with_given_name_db: ExpensePlaceModel = exp_place_crud.get_one_by_name(db=db, name=expense_place_create.name)
    if place_with_given_name_db:
        raise ProcessingException(f'Expense place with name `{expense_place_create.name}` already exists')

    expense_place_db: ExpensePlaceModel = exp_place_crud.create(db=db, obj_in=expense_place_create)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


def search_expense_places(db: Session, request: ExpensePlaceRequest) -> list[ExpensePlace]:
    expense_places_db: list[ExpensePlaceModel] = exp_place_crud.search(db=db, request=request)
    expense_places = parse_obj_as(list[ExpensePlace], expense_places_db)
    return expense_places


def get_expense_place_by_id(db: Session, expense_place_id: int) -> ExpensePlace:
    expense_place_db: ExpensePlaceModel = exp_place_crud.get(db=db, id=expense_place_id)
    if not expense_place_db:
        raise NotFoundEntity(f'Expense place with id #{expense_place_id} not found')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


def update_expense_place(db: Session, expense_place_id: int, expense_place_update: ExpensePlaceUpdate) -> ExpensePlace:
    another_place_db: ExpensePlaceModel = exp_place_crud.get_one_by_name(db=db, name=expense_place_update.name)
    if another_place_db and another_place_db.id != expense_place_id:
        raise ProcessingException(f'Expense place with name `{expense_place_update.name}` already exists')

    expense_place_db: ExpensePlaceModel = exp_place_crud.update(db=db, id=expense_place_id, obj_in=expense_place_update)
    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


def update_expense_place_status(db: Session, expense_place_id: int, status: EntityStatusType) -> ExpensePlace:
    entity_update = EntityStatusUpdate(status=status)
    expense_place_db: ExpensePlaceModel = exp_place_crud.update(db=db, id=expense_place_id, obj_in=entity_update)

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place
