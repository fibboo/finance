import uuid

import pytest

from app.exceptions.exception import ProcessingException, NotFoundEntity
from app.schemas.base import EntityStatusType
from app.schemas.expense.expense_place import (ExpensePlace, ExpensePlaceCreate, ExpensePlaceSearch, ExpensePlaceUpdate,
                                               ExpensePlaceUpdateStatus)
from app.services.expense import place_service


@pytest.mark.asyncio
async def test_create_expense_place(db):
    # Given
    user_id = uuid.uuid4()

    place_create = ExpensePlaceCreate(
        name='Test place',
        description='Test place description',
        status=EntityStatusType.ACTIVE
    )

    # When
    expense_place: ExpensePlace = await place_service.create_expense_place(place_create=place_create, user_id=user_id)

    # Then
    assert expense_place is not None
    assert expense_place.id is not None
    assert expense_place.user_id == user_id
    assert expense_place.name == place_create.name
    assert expense_place.description == place_create.description
    assert expense_place.status == place_create.status


@pytest.mark.asyncio
async def test_create_expense_place_with_existing_name(db):
    # Given
    user_id = uuid.uuid4()

    place_create = ExpensePlaceCreate(
        name='Test place',
        description='Test place description',
        status=EntityStatusType.ACTIVE
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    await db.query_single(query, **place_create.dict(), user_id=user_id)

    # When
    with pytest.raises(ProcessingException) as exc:
        await place_service.create_expense_place(place_create=place_create, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense place with name `{place_create.name}` already exists.'


async def _create_places(db):
    user_id = uuid.uuid4()

    for i in range(5):
        place_create = ExpensePlaceCreate(
            name=f'Test place {i}',
            description=f'Test place description {i}',
            status=EntityStatusType.ACTIVE
        )
        query = """
                SELECT (
                    INSERT expense::ExpensePlace {
                        user_id := <uuid>$user_id,
                        name := <str>$name,
                        description := <optional str>$description,
                        status := <str>$status
                    }) {id, user_id, name, description, status}
                """
        await db.query_single(query, **place_create.dict(), user_id=user_id)

    for i in range(5):
        place_create = ExpensePlaceCreate(
            name=f'Test place {i}{i}',
            description=f'Test place description {i}{i}',
            status=EntityStatusType.DELETED
        )
        query = """
                SELECT (
                    INSERT expense::ExpensePlace {
                        user_id := <uuid>$user_id,
                        name := <str>$name,
                        description := <optional str>$description,
                        status := <str>$status
                    }) {id, user_id, name, description, status}
                """
        await db.query_single(query, **place_create.dict(), user_id=user_id)

    return user_id


@pytest.mark.asyncio
async def test_search_expense_places_with_all_fields_filled(db):
    # Given
    user_id = await _create_places(db)

    request = ExpensePlaceSearch(
        search_term='Ace',
        statuses=[EntityStatusType.ACTIVE]
    )

    # When
    expense_places: list[ExpensePlace] = await place_service.search_expense_places(request=request, user_id=user_id)

    # Then
    assert len(expense_places) == 5
    for expense_place in expense_places:
        assert expense_place.id is not None
        assert expense_place.user_id == user_id
        assert request.search_term in expense_place.name
        assert request.search_term in expense_place.description
        assert expense_place.status == EntityStatusType.ACTIVE


@pytest.mark.asyncio
async def test_search_expense_places_with_all_fields_empty(db):
    # Given
    user_id = await _create_places(db)

    # When
    expense_places: list[ExpensePlace] = await place_service.search_expense_places(request=ExpensePlaceSearch(),
                                                                                   user_id=user_id)

    # Then
    assert len(expense_places) == 10
    for expense_place in expense_places:
        assert expense_place.id is not None
        assert expense_place.user_id == user_id
        assert expense_place.name is not None
        assert expense_place.description is not None
        assert expense_place.status in [EntityStatusType.ACTIVE, EntityStatusType.DELETED]


@pytest.mark.asyncio
async def test_search_expense_places_nothing_found(db):
    # Given
    user_id = await _create_places(db)

    request = ExpensePlaceSearch(
        search_term='nothing',
    )

    # When
    expense_places: list[ExpensePlace] = await place_service.search_expense_places(request=request, user_id=user_id)

    # Then
    assert len(expense_places) == 0


@pytest.mark.asyncio
async def test_get_expense_place_by_id(db):
    # Given
    user_id = uuid.uuid4()

    place_create = ExpensePlaceCreate(
        name='Test place',
        description='Test place description',
        status=EntityStatusType.ACTIVE
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    created_place: ExpensePlace = await db.query_single(query, **place_create.dict(), user_id=user_id)

    # When
    expense_place: ExpensePlace = await place_service.get_expense_place_by_id(place_id=created_place.id,
                                                                              user_id=user_id)

    # Then
    assert expense_place is not None
    assert expense_place.id == created_place.id
    assert expense_place.user_id == created_place.user_id
    assert expense_place.name == created_place.name
    assert expense_place.description == created_place.description
    assert expense_place.status == created_place.status


@pytest.mark.asyncio
async def test_get_expense_place_by_id_not_found(db):
    # Given
    user_id = uuid.uuid4()
    place_id = uuid.uuid4()

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await place_service.get_expense_place_by_id(place_id=place_id, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense place not found by user_id #{user_id} and entity id #{place_id}.'


@pytest.mark.asyncio
async def test_update_expense_place(db):
    # Given
    user_id = uuid.uuid4()

    place_create = ExpensePlaceCreate(
        name='Test place',
        description='Test place description',
        status=EntityStatusType.ACTIVE
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    created_place: ExpensePlace = await db.query_single(query, **place_create.dict(), user_id=user_id)

    request = ExpensePlaceUpdate(
        id=created_place.id,
        name='Test place updated',
        description='Test place description updated',
    )

    # When
    expense_place: ExpensePlace = await place_service.update_expense_place(request=request, user_id=user_id)

    # Then
    assert expense_place is not None
    assert expense_place.id == created_place.id
    assert expense_place.user_id == created_place.user_id
    assert expense_place.name == request.name
    assert expense_place.description == request.description
    assert expense_place.status == created_place.status


@pytest.mark.asyncio
async def test_update_expense_place_not_found(db):
    # Given
    user_id = uuid.uuid4()
    place_id = uuid.uuid4()

    request = ExpensePlaceUpdate(
        id=place_id,
        name='Test place updated',
        description='Test place description updated',
    )

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await place_service.update_expense_place(request=request, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense place not found by user_id #{user_id} and entity id #{request.id}.'


@pytest.mark.asyncio
async def test_update_expense_place_status(db):
    # Given
    user_id = uuid.uuid4()

    place_create = ExpensePlaceCreate(
        name='Test place',
        description='Test place description',
        status=EntityStatusType.ACTIVE
    )
    query = """
            SELECT (
                INSERT expense::ExpensePlace {
                    user_id := <uuid>$user_id,
                    name := <str>$name,
                    description := <optional str>$description,
                    status := <str>$status
                }) {id, user_id, name, description, status}
            """
    created_place: ExpensePlace = await db.query_single(query, **place_create.dict(), user_id=user_id)

    request = ExpensePlaceUpdateStatus(
        id=created_place.id,
        status=EntityStatusType.DELETED
    )

    # When
    expense_place: ExpensePlace = await place_service.update_expense_place_status(request=request, user_id=user_id)

    # Then
    assert expense_place is not None
    assert expense_place.id == created_place.id
    assert expense_place.user_id == created_place.user_id
    assert expense_place.name == created_place.name
    assert expense_place.description == created_place.description
    assert expense_place.status == request.status


@pytest.mark.asyncio
async def test_update_expense_place_status_not_found(db):
    # Given
    user_id = uuid.uuid4()
    place_id = uuid.uuid4()

    request = ExpensePlaceUpdateStatus(
        id=place_id,
        status=EntityStatusType.DELETED
    )

    # When
    with pytest.raises(NotFoundEntity) as exc:
        await place_service.update_expense_place_status(request=request, user_id=user_id)

    # Then
    assert exc.value.message == f'Expense place not found by user_id #{user_id} and entity id #{request.id}.'
