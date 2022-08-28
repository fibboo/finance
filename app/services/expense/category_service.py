import json
from uuid import UUID

import edgedb
from pydantic import parse_obj_as

from app.db.database import db
from app.exceptions.exception import ProcessingException, NotFoundEntity
from app.schemas.expense.expense_category import (ExpenseCategoryCreate, ExpenseCategory, ExpenseCategoryUpdate,
                                                  ExpenseCategorySearch, ExpenseCategoryUpdateStatus)


async def create_expense_category(category_create: ExpenseCategoryCreate, user_id: UUID) -> ExpenseCategory:
    query = """
            SELECT (
                INSERT expense::ExpenseCategory {
                    user_id := <uuid>$user_id,
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, type, name, description, status}
            """
    try:
        expense_category_db = await db.query_single(query, **category_create.dict(), user_id=user_id)

    except edgedb.errors.ConstraintViolationError:
        raise ProcessingException(f'Expense category with name `{category_create.name}` already exists.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


async def search_expense_categories(request: ExpenseCategorySearch, user_id: UUID) -> list[ExpenseCategory]:
    query = """
            WITH user_id := <uuid>$user_id,
                search_term := "%"++<str>$search_term++"%",
                types_array := <array<str>>$types,
                types_set := array_unpack(<array<str>>$types),
                statuses_array := <array<str>>$statuses,
                statuses_set := array_unpack(<array<str>>$statuses)

            SELECT expense::ExpenseCategory {
                id, user_id, type, name, description, status
            } FILTER .user_id = user_id
                AND any({.name ilike search_term, .description ilike search_term})
                AND any({.type IN types_set, len(types_array) = 0})
                AND any({.status IN statuses_set, len(statuses_array) = 0})
            """
    expense_categories_db = await db.query_json(query, **request.dict(), user_id=user_id)

    expense_categories = parse_obj_as(list[ExpenseCategory], json.loads(expense_categories_db))
    return expense_categories


async def get_expense_category_by_id(category_id: UUID, user_id: UUID) -> ExpenseCategory:
    query = """
            SELECT (
                SELECT expense::ExpenseCategory {
                    id, user_id, type, name, description, status
                } FILTER .id = <uuid>$expense_category_id AND .user_id = <uuid>$user_id
            )
            """
    try:
        expense_category_db = await db.query_required_single(query, expense_category_id=category_id, user_id=user_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category not found by user_id #{user_id} and entity id #{category_id}.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


async def update_expense_category(request: ExpenseCategoryUpdate, user_id: UUID) -> ExpenseCategory:
    query = """
            SELECT (
                UPDATE expense::ExpenseCategory
                FILTER .id = <uuid>$id AND .user_id = <uuid>$user_id
                SET {
                    type := <str>$type,
                    name := <str>$name,
                    description := <optional str>$description
                }
            ) {id, user_id, type, name, description, status}
            """
    try:
        expense_category_db = await db.query_required_single(query, **request.dict(), user_id=user_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category not found by user_id #{user_id} and entity id #{request.id}.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category


async def update_expense_category_status(request: ExpenseCategoryUpdateStatus, user_id: UUID) -> ExpenseCategory:
    query = """
            SELECT (
                UPDATE expense::ExpenseCategory
                FILTER .id = <uuid>$id AND .user_id = <uuid>$user_id
                SET {status := <str>$status}
            ) {id, user_id, type, name, description, status}
            """
    try:
        expense_category_db = await db.query_required_single(query, **request.dict(), user_id=user_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category not found by user_id #{user_id} and entity id #{request.id}.')

    expense_category = parse_obj_as(ExpenseCategory, expense_category_db)
    return expense_category
