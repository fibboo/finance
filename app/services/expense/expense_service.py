from typing import Optional

from pydantic import parse_obj_as
from sqlalchemy.orm import Session

from app.crud.expense.expense import expense_crud
from app.crud.expense.expense_category import exp_category_crud
from app.crud.expense.expense_place import exp_place_crud
from app.exceptions.exception import NotFoundEntity
from app.schemas.expense.expense import ExpenseCreate, Expense, ExpenseUpdate, ExpenseRequest
from app.models import (Expense as ExpenseModel, ExpenseCategory as ExpenseCategoryModel,
                        ExpensePlace as ExpensePlaceModel)


def create_expense(db: Session, expense_create: ExpenseCreate) -> Expense:
    expense_category_db: ExpenseCategoryModel = exp_category_crud.get(db=db, id=expense_create.category_id)
    if not expense_category_db:
        raise NotFoundEntity(f'Expense category with id #{expense_create.category_id} not found')

    expense_place_db: ExpensePlaceModel = exp_place_crud.get(db=db, id=expense_create.place_id)
    if not expense_place_db:
        raise NotFoundEntity(f'Expense place with id #{expense_create.place_id} not found')

    expense_db: ExpenseModel = expense_crud.create(db=db, obj_in=expense_create)
    expense = parse_obj_as(Expense, expense_db)
    return expense


def get_expenses(db: Session, request: ExpenseRequest) -> list[Expense]:
    expenses_db: list[ExpenseModel] = expense_crud.get_expenses(db=db, request=request)
    expenses = parse_obj_as(list[Expense], expenses_db)
    return expenses


def get_expense(db: Session, expense_id: int) -> Expense:
    expense_db: Optional[ExpenseModel] = expense_crud.get(db=db, id=expense_id)
    if not expense_db:
        raise NotFoundEntity(f'Expense with id #{expense_id} not found')

    expense = parse_obj_as(Expense, expense_db)
    return expense


def update_expense(db: Session, expense_id: int, expense_update: ExpenseUpdate) -> Expense:
    expense_db: ExpenseModel = expense_crud.update(db=db, id=expense_id, obj_in=expense_update)
    expense = parse_obj_as(Expense, expense_db)
    return expense


def delete_expense(db: Session, expense_id: int) -> None:
    existing_expense_db: ExpenseModel = expense_crud.get(db=db, id=expense_id)
    if not existing_expense_db:
        raise NotFoundEntity(f'Expense with id #{expense_id} not found')

    expense_crud.delete(db=db, id=expense_id)
