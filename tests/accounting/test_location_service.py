from uuid import uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.configs.logging_settings import LogLevelType
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.location import Location as LocationModel
from app.schemas.accounting.location import Location, LocationCreateRequest, LocationRequest, LocationUpdate
from app.schemas.error_response import ErrorCodeType
from app.services.accounting import location_service


@pytest.mark.asyncio
async def test_create_location(db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()

    location_create = LocationCreateRequest(name='Test place')

    # Act
    location: Location = await location_service.create_location(db=db_transaction,
                                                                create_data=location_create,
                                                                user_id=user_id)

    # Assert
    assert location is not None
    assert location.id is not None
    assert location.user_id == user_id
    assert location.name == location_create.name
    assert location.description == location_create.description
    assert location.coordinates is None


@pytest.mark.asyncio
async def test_create_location_with_existing_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()

    location_create = LocationCreateRequest(name='Test place', description='Test place description')
    await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    # Act
    with pytest.raises(IntegrityException) as exc:
        await location_service.create_location(db=db_transaction, create_data=location_create, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == 'Entity integrity error'
    assert exc.value.log_message == (f'Location integrity error: DETAIL:  Key (user_id, name)=({user_id}, '
                                     f'{location_create.name}) already exists.')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 1


@pytest.mark.asyncio
async def test_get_locations(db: AsyncSession):
    # Arrange
    user_id = uuid4()

    for i in range(3):
        location_create = LocationCreateRequest(name=f'Location {i}')
        await location_service.create_location(db=db, create_data=location_create, user_id=user_id)
    await db.commit()

    request_all_p1 = LocationRequest(size=2, page=1)
    request_all_p2 = LocationRequest(size=2, page=2)
    request_search = LocationRequest(search_term='n 1')
    request_not_found = LocationRequest(search_term='not found')

    # Act
    locations_all_p1: Page[Location] = await location_service.get_locations(db=db, request=request_all_p1,
                                                                            user_id=user_id)
    locations_all_p2: Page[Location] = await location_service.get_locations(db=db, request=request_all_p2,
                                                                            user_id=user_id)
    locations_search: Page[Location] = await location_service.get_locations(db=db, request=request_search,
                                                                            user_id=user_id)
    locations_not_found: Page[Location] = await location_service.get_locations(db=db,
                                                                               request=request_not_found,
                                                                               user_id=user_id)

    # Assert
    assert locations_all_p1.total == 3
    assert len(locations_all_p1.items) == 2
    assert locations_all_p1.items[0].name == 'Location 0'
    assert locations_all_p1.items[1].name == 'Location 1'

    assert locations_all_p2.total == 3
    assert len(locations_all_p2.items) == 1
    assert locations_all_p2.items[0].name == 'Location 2'

    assert locations_search.total == 1
    assert len(locations_search.items) == 1
    assert locations_search.items[0].name == 'Location 1'

    assert locations_not_found.total == 0
    assert len(locations_not_found.items) == 0


@pytest.mark.asyncio
async def test_get_location(db: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create = LocationCreateRequest(name='Test place', description='Test place description')
    location: Location = await location_service.create_location(db=db, create_data=location_create,
                                                                user_id=user_id)
    await db.commit()

    # Act
    found_location: Location = await location_service.get_location(db=db, location_id=location.id,
                                                                   user_id=user_id)

    # Assert
    assert found_location is not None
    assert found_location.id == location.id
    assert found_location.user_id == location.user_id
    assert found_location.name == location.name
    assert found_location.description == location.description
    assert found_location.coordinates is None


@pytest.mark.asyncio
async def test_get_location_not_found(db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_id = uuid4()

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.get_location(db=db_transaction, location_id=location_id, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == 'Entity not found'
    search_params = {'id': location_id, 'user_id': user_id}
    assert exc.value.log_message == f'{LocationModel.__name__} not found by {search_params}'
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND


@pytest.mark.asyncio
async def test_update_location_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()

    location_create = LocationCreateRequest(name='Test place', description='Test place description')
    created_location: Location = await location_service.create_location(db=db, create_data=location_create,
                                                                        user_id=user_id)
    await db.commit()

    location_update = LocationUpdate(name='Location updated',
                                     description='Location description updated')

    # Act
    location: Location = await location_service.update_location(db=db_transaction, location_id=created_location.id,
                                                                update_data=location_update, user_id=user_id)
    await db_transaction.commit()

    # Assert
    assert location is not None
    assert location.id == created_location.id
    assert location.user_id == created_location.user_id
    assert location.name == location_update.name
    assert location.description == location_update.description
    assert location.coordinates is None

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 1


@pytest.mark.asyncio
async def test_update_location_not_found(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_id = uuid4()

    location_update = LocationUpdate(name='Location updated',
                                     description='Location description updated')

    # Act
    with pytest.raises(EntityNotFound) as exc:
        await location_service.update_location(db=db_transaction, location_id=location_id,
                                               update_data=location_update, user_id=user_id)

    # Assert
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc.value.message == 'Entity not found'
    search_params = {'id': location_id, 'user_id': user_id}
    assert exc.value.log_message == f'{LocationModel.__name__} not found by {search_params}'
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 0


@pytest.mark.asyncio
async def test_update_location_double(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_id = uuid4()
    location_create_1 = LocationCreateRequest(name='Location 1')
    created_location_1: Location = await location_service.create_location(db=db, create_data=location_create_1,
                                                                          user_id=user_id)
    location_create_2 = LocationCreateRequest(name='Location 2')
    await location_service.create_location(db=db, create_data=location_create_2, user_id=user_id)
    await db.commit()

    location_update = LocationUpdate(name='Location 2', description='Location description updated')

    # Act
    with pytest.raises(IntegrityException) as exc:
        await location_service.update_location(db=db_transaction, location_id=created_location_1.id,
                                               update_data=location_update, user_id=user_id)
        await db_transaction.commit()

    # Assert
    assert exc.value.status_code == status.HTTP_409_CONFLICT
    assert exc.value.message == 'Entity integrity error'
    assert exc.value.log_message == (f'Location integrity error: DETAIL:  Key (user_id, name)=({user_id}, '
                                     f'{location_update.name}) already exists.')
    assert exc.value.log_level == LogLevelType.ERROR
    assert exc.value.error_code == ErrorCodeType.INTEGRITY_ERROR

    transactions: list[LocationModel] = (await db.scalars(select(LocationModel))).all()
    assert len(transactions) == 2
