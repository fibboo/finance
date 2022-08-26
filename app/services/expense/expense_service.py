import json
from uuid import UUID

import edgedb
from pydantic import parse_obj_as

from app.db.database import db
from app.exceptions.exception import NotFoundEntity
from app.schemas.expense.expense import ExpenseCreate, Expense, ExpenseUpdate, ExpenseRequest


async def create_expense(expense_create: ExpenseCreate) -> Expense:
    query = """
            WITH date:=<datetime>$date,
                 amount:=<decimal>$amount,
                 comment:=<optional str>$comment,
                 category_id:=<uuid>$category_id,
                 place_id:=<uuid>$place_id

            SELECT (
                INSERT expense::Expense {
                   date := date,
                   amount := amount,
                   comment := comment,
                   category := assert_single(assert_exists((SELECT expense::ExpenseCategory FILTER .id = category_id))),
                   place := assert_single(assert_exists((SELECT expense::ExpensePlace FILTER .id = place_id)))
                }) {id, date, amount, comment,
                    category: {id, type, name, description, status},
                    place: {id, name, description, status}}
            """
    try:
        expense_db = await db.query_single(query, **expense_create.dict())

    except edgedb.errors.CardinalityViolationError:
        raise NotFoundEntity(f'Expense category or place not found by id. '
                             f'category_id: {expense_create.category_id}, place_id: {expense_create.place_id}')

    expense = parse_obj_as(Expense, expense_db)
    return expense


async def get_expenses(request: ExpenseRequest) -> list[Expense]:
    query = """
            WITH skip:=<int16>$skip, size:=<int16>$size,
                 date_from:=<datetime>$date_from, date_to:=<datetime>$date_to,
                 amount_from:=<decimal>$amount_from, amount_to:=<decimal>$amount_to,
                 category_ids_array:=<array<uuid>>$category_ids, category_ids_set:=array_unpack(<array<uuid>>$category_ids),
                 place_ids_array:=<array<uuid>>$place_ids, place_ids_set:=array_unpack(<array<uuid>>$place_ids)

            SELECT expense::Expense {
                id, date, amount, comment,
                category: {id, type, name, description, status},
                place: {id, name, description, status}
            } FILTER .date >= date_from AND .date <= date_to
                AND .amount >= amount_from AND .amount <= amount_to
                AND any({.category.id IN category_ids_set, len(category_ids_array) = 0})
                AND any({.place.id IN place_ids_set, len(place_ids_array) = 0})
            """ + \
            f'ORDER BY .{request.order_field.value} {request.order_direction.value} ' \
            'OFFSET skip ' \
            'LIMIT size'

    expenses_db = await db.query_json(query, **request.dict(exclude={'order_field', 'order_direction'}))

    expenses = parse_obj_as(list[Expense], json.loads(expenses_db))
    return expenses


async def get_expense_by_id(expense_id: UUID) -> Expense:
    query = """
            SELECT (
                SELECT expense::Expense {
                   date, amount, comment,
                   category: {id, type, name, description, status},
                   place: {id, name, description, status}
                } FILTER .id = <uuid>$expense_id
            )
            """
    try:
        expense_db = await db.query_required_single(query, expense_id=expense_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense not found by id #{expense_id}.')

    expense = parse_obj_as(Expense, expense_db)
    return expense


async def update_expense(expense_update: ExpenseUpdate) -> Expense:
    query = """
            SELECT (
                UPDATE expense::Expense
                FILTER .id = id
                set {
                   date := <uuid>$id,
                   amount := <datetime>$date,
                   comment := <optional str>$comment,
                   category := (SELECT expense::ExpenseCategory FILTER .id = <uuid>$category_id),
                   place := (SELECT expense::ExpensePlace FILTER .id = <uuid>$place_id)
                }
            ) {id, date, amount, comment,
                category: {id, type, name, description, status},
                place: {id, name, description, status}}
            """
    try:
        expense_db = await db.query_single(query, **expense_update.dict())

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense category or place not found by id. '
                             f'category_id: {expense_update.category_id}, place_id: {expense_update.place_id}')

    expense = parse_obj_as(Expense, expense_db)
    return expense


async def delete_expense(expense_id: UUID) -> None:
    query = 'DELETE expense::Expense FILTER .id = <uuid>$expense_id'

    try:
        await db.query(query, expense_id=expense_id)

    except edgedb.ResultCardinalityMismatchError:
        raise NotFoundEntity(f'Expense not found by id #{expense_id}.')
