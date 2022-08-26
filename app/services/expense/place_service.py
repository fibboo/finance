import json
from uuid import UUID

import edgedb
from pydantic import parse_obj_as

from app.db.database import db
from app.exceptions.exception import ProcessingException, NotFoundEntity
from app.schemas.expense.expense_place import (ExpensePlaceCreate, ExpensePlace, ExpensePlaceUpdate, ExpensePlaceSearch,
                                               ExpensePlaceUpdateStatus)


async def create_expense_place(expense_place_create: ExpensePlaceCreate) -> ExpensePlace:
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, name, description, status}
            """
    try:
        expense_place_db = await db.query_single(query, **expense_place_create.dict())

    except edgedb.errors.ConstraintViolationError:
        raise ProcessingException(f'Expense place with name `{expense_place_create.name}` already exists.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


async def search_expense_places(request: ExpensePlaceSearch) -> list[ExpensePlace]:
    query = """
            WITH search_term := "%"++<str>$search_term++"%",
                 statuses_array := <array<str>>$statuses,
                 statuses_set := array_unpack(<array<str>>$statuses)

            SELECT expense::ExpensePlace {
                id, name, description, status
            } FILTER any({.name ilike search_term, .description ilike search_term})
                AND any({.status IN statuses_set, len(statuses_array) = 0})
            """
    expense_places_db = await db.query_json(query, **request.dict())

    expense_places = parse_obj_as(list[ExpensePlace], json.loads(expense_places_db))
    return expense_places



async def get_expense_place_by_id(expense_place_id: UUID) -> ExpensePlace:
    query = """
            SELECT expense::ExpensePlace {
                id, name, description, status
            } FILTER .id = <uuid>$expense_place_id
            """
    try:
        expense_place_db = await db.query_required_single(query, expense_place_id=expense_place_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense place not found by id #{expense_place_id}.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


async def update_expense_place(request: ExpensePlaceUpdate) -> ExpensePlace:
    query = """
            SELECT (
                UPDATE expense::ExpensePlace
                FILTER .id = <uuid>$id
                SET {
                    name := <str>$name,
                    description := <optional str>$description
                }
            ) {id, name, description, status}
            """
    try:
        expense_place_db = await db.query_single(query, **request.dict())

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense place not found by id #{request.id}.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


async def update_expense_place_status(request: ExpensePlaceUpdateStatus) -> ExpensePlace:
    query = """
            SELECT (
                UPDATE expense::ExpensePlace
                FILTER .id = <uuid>$id
                SET {status := <str>$status}
            ) {id, name, description, status}
            """
    try:
        expense_place_db = await db.query_single(query, **request.dict())

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense place not found by id #{request.id}.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place
