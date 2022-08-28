import json
from uuid import UUID

import edgedb
from pydantic import parse_obj_as

from app.db.database import db
from app.exceptions.exception import ProcessingException, NotFoundEntity
from app.schemas.expense.expense_place import (ExpensePlaceCreate, ExpensePlace, ExpensePlaceUpdate, ExpensePlaceSearch,
                                               ExpensePlaceUpdateStatus)


async def create_expense_place(place_create: ExpensePlaceCreate, user_id: UUID) -> ExpensePlace:
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    try:
        expense_place_db = await db.query_single(query, **place_create.dict(), user_id=user_id)

    except edgedb.errors.ConstraintViolationError:
        raise ProcessingException(f'Expense place with name `{place_create.name}` already exists.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


async def search_expense_places(request: ExpensePlaceSearch, user_id: UUID) -> list[ExpensePlace]:
    query = """
            WITH user_id := <uuid>$user_id,
                search_term := "%"++<str>$search_term++"%",
                statuses_array := <array<str>>$statuses,
                statuses_set := array_unpack(<array<str>>$statuses)

            SELECT expense::ExpensePlace {
                id, user_id, name, description, status
            } FILTER .user_id = user_id
                AND any({.name ilike search_term, .description ilike search_term})
                AND any({.status IN statuses_set, len(statuses_array) = 0})
            """
    expense_places_db = await db.query_json(query, **request.dict(), user_id=user_id)

    expense_places = parse_obj_as(list[ExpensePlace], json.loads(expense_places_db))
    return expense_places


async def get_expense_place_by_id(place_id: UUID, user_id: UUID) -> ExpensePlace:
    query = """
            SELECT expense::ExpensePlace {
                id, user_id, name, description, status
            } FILTER .id = <uuid>$expense_place_id AND .user_id = <uuid>$user_id
            """
    try:
        expense_place_db = await db.query_required_single(query, expense_place_id=place_id, user_id=user_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense place not found by user_id #{user_id} and entity id #{place_id}.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


async def update_expense_place(request: ExpensePlaceUpdate, user_id: UUID) -> ExpensePlace:
    query = """
            SELECT (
                UPDATE expense::ExpensePlace
                FILTER .id = <uuid>$id AND .user_id = <uuid>$user_id
                SET {
                    name := <str>$name,
                    description := <optional str>$description
                }
            ) {id, user_id, name, description, status}
            """
    try:
        expense_place_db = await db.query_required_single(query, **request.dict(), user_id=user_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense place not found by user_id #{user_id} and entity id #{request.id}.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place


async def update_expense_place_status(request: ExpensePlaceUpdateStatus, user_id: UUID) -> ExpensePlace:
    query = """
            SELECT (
                UPDATE expense::ExpensePlace
                FILTER .id = <uuid>$id AND .user_id = <uuid>$user_id
                SET {status := <str>$status}
            ) {id, user_id, name, description, status}
            """
    try:
        expense_place_db = await db.query_required_single(query, **request.dict(), user_id=user_id)

    except edgedb.errors.NoDataError:
        raise NotFoundEntity(f'Expense place not found by user_id #{user_id} and entity id #{request.id}.')

    expense_place = parse_obj_as(ExpensePlace, expense_place_db)
    return expense_place
