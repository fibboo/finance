from uuid import UUID, uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.crud.accounting.location import location_crud
from app.exceptions.conflict_409 import NameAlreadyExists
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.location import Location as LocationModel
from app.schemas.accounting.location import (
    Location,
    LocationCreate,
    LocationCreateRequest,
    LocationRequest,
    LocationUpdate,
)
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import location_service


async def test_create_location(db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()

    location_create = LocationCreateRequest(name="Test place")

    # Act
    location: Location = await location_service.create_location(
        db=db_transaction, create_data=location_create, user_id=user_id
    )

    # Assert
    assert location is not None
    assert location.id is not None
    assert location.user_id == user_id
    assert location.name == location_create.name
    assert location.description == location_create.description
    assert location.status == EntityStatusType.ACTIVE


async def test_create_location_with_existing_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()

    location_create = LocationCreateRequest(name="Test place", description="Test place description")
    await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    # Act
    with pytest.raises(NameAlreadyExists) as exc:
        await location_service.create_location(db=db_transaction, create_data=location_create, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Name already exists"
    assert exc.value.log_message == f"User `{user_id}` already has an active Location with this name"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 1


async def test_get_locations(db: AsyncSession):
    # Arrange
    user_id = uuid4()

    for i in range(3):
        location_create = LocationCreateRequest(name=f"Location {i}")
        await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    request_all_p1 = LocationRequest(size=2, page=1)
    request_all_p2 = LocationRequest(size=2, page=2)
    request_search = LocationRequest(search_term="n 1")
    request_not_found = LocationRequest(search_term="not found")

    # Act
    locations_all_p1: Page[Location] = await location_service.get_locations(
        db=db, request=request_all_p1, user_id=user_id
    )
    locations_all_p2: Page[Location] = await location_service.get_locations(
        db=db, request=request_all_p2, user_id=user_id
    )
    locations_search: Page[Location] = await location_service.get_locations(
        db=db, request=request_search, user_id=user_id
    )
    locations_not_found: Page[Location] = await location_service.get_locations(
        db=db, request=request_not_found, user_id=user_id
    )

    # Assert
    assert locations_all_p1.total == 3
    assert len(locations_all_p1.items) == 2
    assert locations_all_p1.items[0].name == "Location 0"
    assert locations_all_p1.items[1].name == "Location 1"

    assert locations_all_p2.total == 3
    assert len(locations_all_p2.items) == 1
    assert locations_all_p2.items[0].name == "Location 2"

    assert locations_search.total == 1
    assert len(locations_search.items) == 1
    assert locations_search.items[0].name == "Location 1"

    assert locations_not_found.total == 0
    assert len(locations_not_found.items) == 0


async def test_get_locations_more_than_twenty(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    for i in range(25):
        location_create = LocationCreate(name=f"Location {i:02}", user_id=user_id)
        await location_crud.create(db=db, obj_in=location_create, commit=True)

    request = LocationRequest(size=10, page=3)

    # Act
    locations: Page[Location] = await location_service.get_locations(db=db, request=request, user_id=user_id)

    # Assert
    assert locations.total == 25
    assert locations.pages == 3
    assert [location.name for location in locations.items] == [f"Location {i:02}" for i in range(20, 25)]


async def test_get_location(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create = LocationCreateRequest(name="Test place", description="Test place description")
    location: Location = await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    # Act
    found_location: Location = await location_service.get_location(db=db, location_id=location.id, user_id=user_id)

    # Assert
    assert found_location is not None
    assert found_location.id == location.id
    assert found_location.user_id == location.user_id
    assert found_location.name == location.name
    assert found_location.description == location.description
    assert found_location.status == EntityStatusType.ACTIVE


async def test_get_location_not_found(db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_id = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.get_location(db=db_transaction, location_id=location_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": location_id, "user_id": user_id}
    assert exc.value.log_message == f"{LocationModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_update_location_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()

    location_create = LocationCreateRequest(name="Test place", description="Test place description")
    created_location: Location = await location_service.create_location(
        db=db, create_data=location_create, user_id=user_id
    )
    await db.commit()

    location_update = LocationUpdate(name="Location updated", description="Location description updated")

    # Act
    location: Location = await location_service.update_location(
        db=db_transaction, location_id=created_location.id, update_data=location_update, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert location is not None
    assert location.id == created_location.id
    assert location.user_id == created_location.user_id
    assert location.name == location_update.name
    assert location.description == location_update.description
    assert location.status == EntityStatusType.ACTIVE

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 1


async def test_update_location_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_id = uuid4()

    location_update = LocationUpdate(name="Location updated", description="Location description updated")

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.update_location(
            db=db_transaction, location_id=location_id, update_data=location_update, user_id=user_id
        )

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": location_id, "user_id": user_id}
    assert exc.value.log_message == f"{LocationModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 0


async def test_update_location_double(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create_1 = LocationCreateRequest(name="Location 1")
    created_location_1: Location = await location_service.create_location(
        db=db, create_data=location_create_1, user_id=user_id
    )
    location_create_2 = LocationCreateRequest(name="Location 2")
    await location_service.create_location(db=db, create_data=location_create_2, user_id=user_id)
    await db.commit()

    location_update = LocationUpdate(name="Location 2", description="Location description updated")

    # Act
    with pytest.raises(NameAlreadyExists) as exc:
        await location_service.update_location(
            db=db_transaction, location_id=created_location_1.id, update_data=location_update, user_id=user_id
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Name already exists"
    assert exc.value.log_message == f"User `{user_id}` already has an active Location with this name"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 2


@pytest.mark.parametrize("search_term, expected_names", [("0% c", ["100% cash"]), ("a_b", ["a_b test"])])
async def test_get_locations_search_term_wildcards(db: AsyncSession, search_term: str, expected_names: list[str]):
    # Arrange
    user_id = uuid4()
    for name in ["100% cash", "100 cash", "a_b test", "axb test"]:
        location_create = LocationCreateRequest(name=name)
        await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    request = LocationRequest(search_term=search_term)

    # Act
    locations: Page[Location] = await location_service.get_locations(db=db, request=request, user_id=user_id)

    # Assert
    assert [location.name for location in locations.items] == expected_names


async def test_get_locations_by_status(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    active_location: Location = await location_service.create_location(
        db=db, create_data=LocationCreateRequest(name="Active place"), user_id=user_id
    )
    deleted_location: Location = await location_service.create_location(
        db=db, create_data=LocationCreateRequest(name="Deleted place"), user_id=user_id
    )
    await location_service.delete_location(db=db, location_id=deleted_location.id, user_id=user_id)
    await db.commit()

    request_default = LocationRequest()
    request_deleted = LocationRequest(statuses=[EntityStatusType.DELETED])
    request_all = LocationRequest(statuses=[EntityStatusType.ACTIVE, EntityStatusType.DELETED])

    # Act
    locations_default: Page[Location] = await location_service.get_locations(
        db=db, request=request_default, user_id=user_id
    )
    locations_deleted: Page[Location] = await location_service.get_locations(
        db=db, request=request_deleted, user_id=user_id
    )
    locations_all: Page[Location] = await location_service.get_locations(db=db, request=request_all, user_id=user_id)

    # Assert
    assert [location.id for location in locations_default.items] == [active_location.id]
    assert [location.id for location in locations_deleted.items] == [deleted_location.id]
    assert [location.id for location in locations_all.items] == [active_location.id, deleted_location.id]


async def test_get_location_deleted(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create_data: dict = {"user_id": user_id, "name": "Test place", "status": EntityStatusType.DELETED}
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.get_location(db=db_transaction, location_id=location_db.id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    search_params = {"id": location_db.id, "user_id": user_id}
    assert exc.value.log_message == f"{LocationModel.__name__} not found by {search_params}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_delete_location_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    created_location: Location = await location_service.create_location(
        db=db, create_data=LocationCreateRequest(name="Test place"), user_id=user_id
    )
    await db.commit()

    # Act
    location: Location = await location_service.delete_location(
        db=db_transaction, location_id=created_location.id, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert location.id == created_location.id
    assert location.name == created_location.name
    assert location.status == EntityStatusType.DELETED

    location_db: LocationModel = await location_crud.get(db=db, id=created_location.id)
    await db.refresh(location_db)
    assert location_db.status == EntityStatusType.DELETED


@pytest.mark.parametrize("location_status", [None, EntityStatusType.DELETED])
async def test_delete_location_not_found(
    db: AsyncSession, db_transaction: AsyncSession, location_status: EntityStatusType | None
):
    # Arrange
    user_id = uuid4()
    location_id = uuid4()
    # a location of the user that is already deleted is not found either
    if location_status is not None:
        location_create_data: dict = {"user_id": user_id, "name": "Test place", "status": location_status}
        location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)
        location_id = location_db.id

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.delete_location(db=db_transaction, location_id=location_id, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": location_id, "user_id": user_id}
    assert exc.value.log_message == f"{LocationModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_create_location_name_of_deleted_location(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create = LocationCreateRequest(name="Test place")
    deleted_location: Location = await location_service.create_location(
        db=db, create_data=location_create, user_id=user_id
    )
    await location_service.delete_location(db=db, location_id=deleted_location.id, user_id=user_id)
    await db.commit()

    # Act
    location: Location = await location_service.create_location(
        db=db_transaction, create_data=location_create, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert location.id != deleted_location.id
    assert location.name == deleted_location.name
    assert location.status == EntityStatusType.ACTIVE

    locations: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(locations) == 2


async def test_restore_location_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    created_location: Location = await location_service.create_location(
        db=db, create_data=LocationCreateRequest(name="Test place"), user_id=user_id
    )
    await location_service.delete_location(db=db, location_id=created_location.id, user_id=user_id)
    await db.commit()

    # Act
    location: Location = await location_service.restore_location(
        db=db_transaction, location_id=created_location.id, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert location.id == created_location.id
    assert location.name == created_location.name
    assert location.status == EntityStatusType.ACTIVE

    locations: Page[Location] = await location_service.get_locations(db=db, request=LocationRequest(), user_id=user_id)
    assert [location.id for location in locations.items] == [created_location.id]


@pytest.mark.parametrize("location_status", [None, EntityStatusType.ACTIVE])
async def test_restore_location_not_found(
    db: AsyncSession, db_transaction: AsyncSession, location_status: EntityStatusType | None
):
    # Arrange
    user_id = uuid4()
    location_id = uuid4()
    # a location of the user that is active is not found either
    if location_status is not None:
        location_create_data: dict = {"user_id": user_id, "name": "Test place", "status": location_status}
        location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)
        location_id = location_db.id

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.restore_location(db=db_transaction, location_id=location_id, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == "Entity not found"
    search_params = {"id": location_id, "user_id": user_id}
    assert exc.value.log_message == f"{LocationModel.__name__} not found by {search_params}"
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


async def test_restore_location_name_taken(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create = LocationCreateRequest(name="Test place")
    deleted_location: Location = await location_service.create_location(
        db=db, create_data=location_create, user_id=user_id
    )
    await location_service.delete_location(db=db, location_id=deleted_location.id, user_id=user_id)
    await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    # Act
    with pytest.raises(NameAlreadyExists) as exc:
        await location_service.restore_location(db=db_transaction, location_id=deleted_location.id, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == "Name already exists"
    assert exc.value.log_message == f"User `{user_id}` already has an active Location with this name"
    assert exc.value.log_level == LogLevelType.INFO
    assert exc.value.error_code == ErrorCodeType.NAME_ALREADY_EXISTS

    location_db: LocationModel = await location_crud.get(db=db, id=deleted_location.id)
    await db.refresh(location_db)
    assert location_db.status == EntityStatusType.DELETED


async def test_update_location_deleted(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create_data: dict = {"user_id": user_id, "name": "Test place", "status": EntityStatusType.DELETED}
    location_db: LocationModel = await location_crud.create(db=db, obj_in=location_create_data, commit=True)

    location_update = LocationUpdate(name="Location updated")

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.update_location(
            db=db_transaction, location_id=location_db.id, update_data=location_update, user_id=user_id
        )
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    search_params = {"id": location_db.id, "user_id": user_id}
    assert exc.value.log_message == f"{LocationModel.__name__} not found by {search_params}"
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    await db.refresh(location_db)
    assert location_db.name == "Test place"
    assert location_db.status == EntityStatusType.DELETED


async def test_update_location_name_of_deleted_location(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    deleted_location: Location = await location_service.create_location(
        db=db, create_data=LocationCreateRequest(name="Deleted place"), user_id=user_id
    )
    await location_service.delete_location(db=db, location_id=deleted_location.id, user_id=user_id)
    created_location: Location = await location_service.create_location(
        db=db, create_data=LocationCreateRequest(name="Test place"), user_id=user_id
    )
    await db.commit()

    location_update = LocationUpdate(name="Deleted place")

    # Act
    location: Location = await location_service.update_location(
        db=db_transaction, location_id=created_location.id, update_data=location_update, user_id=user_id
    )
    await db_transaction.commit()

    # Assert
    assert location.id == created_location.id
    assert location.name == "Deleted place"
    assert location.status == EntityStatusType.ACTIVE
