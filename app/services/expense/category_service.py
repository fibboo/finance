import json
from uuid import UUID

import edgedb
from pydantic import parse_obj_as

from app.db.database import db
from app.exceptions.exception import ProcessingException, NotFoundEntity
from app.schemas.expense.expense_category import (ExpenseCategoryCreate, ExpenseCategory, ExpenseCategoryUpdate,
                                                  ExpenseCategorySearch, ExpenseCategoryUpdateStatus)


async def create_expense_category(expense_cat_create: ExpenseCategoryCreate) -> ExpenseCategory:
    query = """
            SELECT (
                INSERT expense::ExpenseCategory {
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := status:=<str>$status
                }) {id, type, name, description, status}
            """
    try:
        expense_category_db = await db.query_single(query, **expense_cat_create.dict())

    except edgedb.errors.ConstraintViolationError:
        raise ProcessingException(f'Expense category with name `{expense_cat_create.name}` already exists.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


async def search_expense_categories(request: ExpenseCategorySearch) -> list[ExpenseCategory]:
    query = """
            WITH search_term := "%"++<str>$search_term++"%",
                 types_array := <array<str>>$types,
                 types_set := array_unpack(<array<str>>$types),
                 statuses_array := <array<str>>$statuses,
                 statuses_set := array_unpack(<array<str>>$statuses)

            SELECT expense::ExpenseCategory {
                id, type, name, description, status
            } FILTER any({.name ilike search_term, .description ilike search_term})
                AND any({.type IN types_set, len(types_array) = 0})
                AND any({.status IN statuses_set, len(statuses_array) = 0})
            """
    expense_categories_db = await db.query_json(query, **request.dict())

    expense_categories = parse_obj_as(list[ExpenseCategory], json.loads(expense_categories_db))
    return expense_categories


async def get_expense_category_by_id(expense_category_id: UUID) -> ExpenseCategory:
    query = """
            SELECT (
                SELECT expense::ExpenseCategory {
                    id, type, name, description, status
                } FILTER .id = <uuid>$expense_category_id
            )
            """
    try:
        expense_category_db = await db.query_required_single(query, expense_category_id=expense_category_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category not found by id #{expense_category_id}.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


async def update_expense_category(request: ExpenseCategoryUpdate) -> ExpenseCategory:
    query = """
            SELECT (
                UPDATE expense::ExpenseCategory
                FILTER .id = <uuid>$id
                SET {
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description
                }
            ) {id, type, name, description, status}
            """
    try:
        expense_category_db = await db.query_required_single(query, **request.dict())

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category not found by id #{request.id}.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


async def update_expense_category_status(request: ExpenseCategoryUpdateStatus) -> ExpenseCategory:
    query = """
            SELECT (
                UPDATE expense::ExpenseCategory
                FILTER .id = <uuid>$id
                SET {status := <str>$status}
            ) {id, type, name, description, status}
            """
    try:
        expense_category_db = await db.query_required_single(query, **request.dict())

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category not found by id #{request.id}.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category
