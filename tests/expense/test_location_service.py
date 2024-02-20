from uuid import uuid4

import pytest
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.expense.location import location_crud
from app.exceptions.exception import ProcessingException, NotFoundException, IntegrityExistException
from app.models import Location as LocationModel
from app.schemas.base import EntityStatusType
from app.schemas.expense.location import Location, LocationCreate, LocationRequest, LocationUpdate
from app.services.expense import location_service


@pytest.mark.asyncio
async def test_create_location(db: AsyncSession):
    # Given
    user_id = uuid4()

    location_create = LocationCreate(name='Test place')

    # When
    location: Location = await location_service.create_location(db=db,
                                                                location_create=location_create,
                                                                user_id=user_id)

    # Then
    assert location is not None
    assert location.id is not None
    assert location.user_id == user_id
    assert location.name == location_create.name
    assert location.description == location_create.description
    assert location.status == EntityStatusType.ACTIVE
    assert location.created_at is not None
    assert location.updated_at == location.created_at


@pytest.mark.asyncio
async def test_create_location_with_existing_name(db: AsyncSession):
    # Given
    user_id = uuid4()

    location_create = LocationCreate(name='Test place', description='Test place description')
    await location_service.create_location(db=db, location_create=location_create, user_id=user_id)

    # When
    with pytest.raises(ProcessingException) as exc:
        await location_service.create_location(db=db, location_create=location_create, user_id=user_id)

    # Then
    assert exc.value.message == (f'Location integrity exception: DETAIL:  Key (user_id, name, status)=({user_id}, '
                                 f'{location_create.name}, ACTIVE) already exists.')


@pytest.mark.asyncio
async def test_get_locations_with_all_fields_filled(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    for i in range(5):
        location_create = LocationModel(user_id=user_id, name=f'Test place {i}', status=EntityStatusType.ACTIVE)
        await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    for i in range(5):
        location_create = LocationModel(user_id=user_id, name=f'Test place {i}{i}', status=EntityStatusType.DELETED)
        await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    request = LocationRequest(search_term='Ace', statuses=[EntityStatusType.ACTIVE])

    # When
    locations: Page[Location] = await location_service.get_locations(db=db_fixture, request=request, user_id=user_id)

    # Then
    assert locations.total == 5
    for location in locations.items:
        assert location.id is not None
        assert location.user_id == user_id
        assert request.search_term.lower() in location.name.lower()
        assert location.status == EntityStatusType.ACTIVE
        assert location.created_at is not None
        assert location.updated_at is not None


@pytest.mark.asyncio
async def test_get_locations_with_all_fields_empty(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    for i in range(5):
        location_create = LocationModel(user_id=user_id, name=f'Test place {i}', status=EntityStatusType.ACTIVE)
        await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    for i in range(5):
        location_create = LocationModel(user_id=user_id, name=f'Test place {i}{i}', status=EntityStatusType.DELETED)
        await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    request = LocationRequest(statuses=[EntityStatusType.ACTIVE, EntityStatusType.DELETED])

    # When
    locations: Page[Location] = await location_service.get_locations(db=db_fixture, request=request, user_id=user_id)

    # Then
    assert locations.total == 10
    for location in locations.items:
        assert location.id is not None
        assert location.user_id == user_id
        assert location.name is not None
        assert location.description is None
        assert location.status in [EntityStatusType.ACTIVE, EntityStatusType.DELETED]
        assert location.created_at is not None
        assert location.updated_at is not None


@pytest.mark.asyncio
async def test_get_locations_nothing_found(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    for i in range(5):
        location_create = LocationModel(user_id=user_id, name=f'Test place {i}', status=EntityStatusType.ACTIVE)
        await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    for i in range(5):
        location_create = LocationModel(user_id=user_id, name=f'Test place {i}{i}', status=EntityStatusType.DELETED)
        await location_crud.create(db=db_fixture, obj_in=location_create, commit=True)

    request = LocationRequest(search_term=f'nothing')

    # When
    locations: Page[Location] = await location_service.get_locations(db=db_fixture, request=request, user_id=user_id)

    # Then
    assert locations.total == 0


@pytest.mark.asyncio
async def test_get_location_by_id(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    location_create = LocationCreate(name='Test place', description='Test place description')
    location: Location = await location_service.create_location(db=db_fixture, location_create=location_create,
                                                                user_id=user_id)
    await db_fixture.commit()

    # When
    found_location: Location = await location_service.get_location_by_id(db=db_fixture, location_id=location.id,
                                                                         user_id=user_id)

    # Then
    assert found_location is not None
    assert found_location.id == location.id
    assert found_location.user_id == location.user_id
    assert found_location.name == location.name
    assert found_location.description == location.description
    assert found_location.status == location.status
    assert found_location.created_at == location.created_at
    assert found_location.updated_at == location.updated_at


@pytest.mark.asyncio
async def test_get_location_by_id_not_found(db: AsyncSession):
    # Given
    user_id = uuid4()
    location_id = uuid4()

    # When
    with pytest.raises(NotFoundException) as exc:
        await location_service.get_location_by_id(db=db, location_id=location_id, user_id=user_id)

    # Then
    assert exc.value.message == f'Location not found by user_id #{user_id} and location_id #{location_id}.'


@pytest.mark.asyncio
async def test_update_location_correct_data(db_fixture: AsyncSession, db: AsyncSession):
    # Given
    user_id = uuid4()

    location_create_model = LocationModel(user_id=user_id,
                                          name=f'Location',
                                          description=f'Location description',
                                          status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_model, commit=True)

    location_update = LocationUpdate(name='Location updated',
                                     description='Location description updated')

    # When
    location: Location = await location_service.update_location(db=db, location_id=location_db.id,
                                                                request=location_update, user_id=user_id)
    await db.commit()

    # Then
    assert location is not None
    assert location.id == location_db.id
    assert location.user_id == location_db.user_id
    assert location.name == location_update.name
    assert location.description == location_update.description
    assert location.status == location_db.status
    assert location.created_at == location_db.created_at
    assert location.updated_at != location_db.updated_at


@pytest.mark.asyncio
async def test_update_location_not_found(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    wrong_user_id = uuid4()
    location_id = uuid4()

    location_create_model = LocationModel(user_id=user_id,
                                          name=f'Location 1',
                                          description=f'Location description',
                                          status=EntityStatusType.ACTIVE)
    await location_crud.create(db=db_fixture, obj_in=location_create_model, commit=True)

    location_update = LocationUpdate(name='Location updated',
                                     description='Location description updated')

    # When
    with pytest.raises(NotFoundException) as exc:
        await location_service.update_location(db=db_fixture, location_id=location_id,
                                               request=location_update, user_id=wrong_user_id)

    # Then
    assert exc.value.message == f'Location not found by user_id #{wrong_user_id} and location_id #{location_id}'


@pytest.mark.asyncio
async def test_update_location_double(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()
    location_create_model = LocationModel(user_id=user_id,
                                          name=f'Location 1',
                                          description=f'Location description 2',
                                          status=EntityStatusType.ACTIVE)
    await location_crud.create(db=db_fixture, obj_in=location_create_model, commit=True)

    location_create_model = LocationModel(user_id=user_id,
                                          name=f'Location 2',
                                          description=f'Location description 2',
                                          status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_model, commit=True)

    location_update = LocationUpdate(name='Location 1',
                                     description='Location description updated')

    # When
    with pytest.raises(IntegrityExistException) as exc:
        await location_service.update_location(db=db_fixture, location_id=location_db.id,
                                               request=location_update, user_id=user_id)

    # Then
    assert exc.value.message == (f'Location integrity exception: DETAIL:  Key (user_id, name, status)=({user_id}, '
                                 f'{location_update.name}, ACTIVE) already exists.')


@pytest.mark.asyncio
async def test_delete_location(db_fixture: AsyncSession):
    # Given
    user_id = uuid4()

    location_create_model = LocationModel(user_id=user_id,
                                          name=f'Location 2',
                                          description=f'Location description 2',
                                          status=EntityStatusType.ACTIVE)
    location_db: LocationModel = await location_crud.create(db=db_fixture, obj_in=location_create_model, commit=True)

    # When
    await location_service.delete_location(db=db_fixture, location_id=location_db.id, user_id=user_id)
    await db_fixture.commit()

    # Then
    locations_db: list[Location] = await location_crud.get_batch(db=db_fixture, user_id=user_id)
    assert len(locations_db) == 1
    assert locations_db[0].status == EntityStatusType.DELETED


@pytest.mark.asyncio
async def test_delete_location_not_found(db_fixture: AsyncSession):
    # Given
    fake_user_id = uuid4()
    fake_location_id = uuid4()

    # When
    with pytest.raises(NotFoundException) as exc:
        await location_service.delete_location(db=db_fixture, location_id=fake_location_id, user_id=fake_user_id)

    # Then
    assert exc.value.message == f'Location not found by user_id #{fake_user_id} and location_id #{fake_location_id}'
