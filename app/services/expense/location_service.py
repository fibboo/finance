from typing import Optional
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.expense.location import location_crud
from app.exceptions.exception import NotFoundEntity, IntegrityExistException
from app.models import Location as LocationModel
from app.schemas.base import EntityStatusType
from app.schemas.expense.location import LocationCreate, Location, LocationUpdate, LocationRequest


async def create_location(db: AsyncSession, location_create: LocationCreate, user_id: UUID) -> Location:
    obj_in: LocationModel = LocationModel(**location_create.model_dump(),
                                          user_id=user_id,
                                          status=EntityStatusType.ACTIVE)
    try:
        expense_db: LocationModel = await location_crud.create(db=db, obj_in=obj_in)
    except IntegrityError as exc:
        raise IntegrityExistException(model=LocationModel, exception=exc)

    expense: Location = Location.model_validate(expense_db)
    return expense


async def get_locations(db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
    locations_db: Page[LocationModel] = await location_crud.get_locations(db=db, request=request, user_id=user_id)
    categories: Page[Location] = Page[Location].model_validate(locations_db)
    return categories


async def get_location_by_id(db: AsyncSession, location_id: UUID, user_id: UUID) -> Location:
    location_db: Optional[Location] = await location_crud.get(db=db, id=location_id, user_id=user_id)

    if location_db is None:
        raise NotFoundEntity(f'Location not found by user_id #{user_id} and location_id #{location_id}.')

    location: Location = Location.model_validate(location_db)
    return location


async def update_location(db: AsyncSession, location_id: UUID, request: LocationUpdate, user_id: UUID) -> Location:
    try:
        location_db: Optional[LocationModel] = await location_crud.update(db=db,
                                                                          id=location_id,
                                                                          obj_in=request,
                                                                          user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityExistException(model=LocationModel, exception=exc)

    if location_db is None:
        raise NotFoundEntity(f'Location not found by user_id #{user_id} and location_id #{location_id}')

    location: Location = Location.model_validate(location_db)
    return location


async def delete_location(db: AsyncSession, location_id: UUID, user_id: UUID) -> None:
    delete_update_data = {'status': EntityStatusType.DELETED}
    try:
        location_db: Optional[LocationModel] = await location_crud.update(db=db,
                                                                          id=location_id,
                                                                          obj_in=delete_update_data,
                                                                          user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityExistException(model=LocationModel, exception=exc)

    if location_db is None:
        raise NotFoundEntity(f'Location not found by user_id #{user_id} and location_id #{location_id}')
