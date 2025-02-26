from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.transaction.location import location_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.transaction.location import Location as LocationModel
from app.schemas.transaction.location import (Location, LocationCreate, LocationCreateRequest, LocationRequest,
                                              LocationUpdate)

logger = get_logger(__name__)


async def create_location(db: AsyncSession, create_data: LocationCreateRequest, user_id: UUID) -> Location:
    obj_in: LocationCreate = LocationCreate(**create_data.model_dump(),
                                            user_id=user_id)
    try:
        expense_db: LocationModel = await location_crud.create(db=db, obj_in=obj_in)
    except IntegrityError as exc:
        raise IntegrityException(entity=LocationModel, exception=exc, logger=logger)

    expense: Location = Location.model_validate(expense_db)
    return expense


async def get_locations(db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
    locations_db: Page[LocationModel] = await location_crud.get_locations(db=db, request=request, user_id=user_id)
    categories: Page[Location] = Page[Location].model_validate(locations_db)
    return categories


async def get_location_by_id(db: AsyncSession, location_id: UUID, user_id: UUID) -> Location:
    location_db: LocationModel | None = await location_crud.get_or_none(db=db, id=location_id, user_id=user_id)

    if location_db is None:
        raise EntityNotFound(entity=LocationModel, search_params={'id': location_id, 'user_id': user_id}, logger=logger)

    location: Location = Location.model_validate(location_db)
    return location


async def update_location(db: AsyncSession,
                          location_id: UUID,
                          update_data: LocationUpdate,
                          user_id: UUID) -> Location:
    try:
        location_db: LocationModel | None = await location_crud.update(db=db,
                                                                       obj_in=update_data,
                                                                       id=location_id,
                                                                       user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=LocationModel, exception=exc, logger=logger)

    if location_db is None:
        raise EntityNotFound(entity=LocationModel, search_params={'id': location_id, 'user_id': user_id}, logger=logger)

    location: Location = Location.model_validate(location_db)
    return location
