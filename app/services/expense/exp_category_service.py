from pydantic import parse_obj_as
from sqlalchemy.orm import Session

from app.crud.expense.expense_category import exp_category_crud
from app.exceptions.exception import NotFoundEntity, ProcessingException
from app.schemas.base import EntityStatusType, EntityStatusUpdate
from app.schemas.expense.expense_category import (ExpenseCategoryCreate, ExpenseCategory, ExpenseCategoryUpdate,
                                                  ExpenseType, ExpenseCategoryRequest)
from app.models import ExpenseCategory as ExpenseCategoryModel


def create_expense_category(db: Session, expense_cat_create: ExpenseCategoryCreate) -> ExpenseCategory:
    category_with_type_name_db: ExpenseCategoryModel = exp_category_crud.get_one_by_type_and_name(db=db,
                                                                                                  type=expense_cat_create.type,
                                                                                                  name=expense_cat_create.name)
    if category_with_type_name_db:
        raise ProcessingException(f'Expense category with type `{expense_cat_create.type}` '
                                  f'and name `{expense_cat_create.name}` already exists')

    expense_category_db: ExpenseCategoryModel = exp_category_crud.create(db=db, obj_in=expense_cat_create)
    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


def search_expense_categories(db: Session, request: ExpenseCategoryRequest) -> list[ExpenseCategory]:
    expense_categories_db: list[ExpenseCategoryModel] = exp_category_crud.search(db=db, request=request)
    expense_categories = parse_obj_as(list[ExpenseCategory], expense_categories_db)
    return expense_categories


def get_expense_category_by_id(db: Session, expense_cat_id: int) -> ExpenseCategory:
    expense_category_db: ExpenseCategoryModel = exp_category_crud.get(db=db, id=expense_cat_id)
    if not expense_category_db:
        raise NotFoundEntity(f'Expense category with id #{expense_cat_id} not found')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


def update_expense_category(db: Session,
                            expense_cat_id: int,
                            expense_cat_update: ExpenseCategoryUpdate) -> ExpenseCategory:
    another_category_db: ExpenseCategoryModel = exp_category_crud.get_one_by_type_and_name(db=db,
                                                                                           type=expense_cat_update.type,
                                                                                           name=expense_cat_update.name)
    if another_category_db and another_category_db.id != expense_cat_id:
        raise ProcessingException(f'Expense category with type `{expense_cat_update.type}` '
                                  f'and name `{expense_cat_update.name}` already exists')

    expense_category_db: ExpenseCategoryModel = exp_category_crud.update(db=db,
                                                                         id=expense_cat_id,
                                                                         obj_in=expense_cat_update)

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


def update_expense_category_status(db: Session, expense_cat_id: int, status: EntityStatusType) -> ExpenseCategory:
    entity_update = EntityStatusUpdate(status=status)
    expense_category_db: ExpenseCategoryModel = exp_category_crud.update(db=db, id=expense_cat_id, obj_in=entity_update)

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category
