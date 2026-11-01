from datetime import date, datetime, UTC
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.location import location_crud
from app.exceptions.conflict_409 import ConflictException, IntegrityException, NameAlreadyExists
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.location import Location as LocationModel, LOCATION_UNIQUE_NAME_INDEX
from app.schemas.accounting.location import (
    Location,
    LocationCreate,
    LocationCreateRequest,
    LocationRequest,
    LocationUpdate,
)
from app.schemas.base import EntityStatusType

logger = get_logger(logger_name=__name__)
from app.utils import utils


def _get_integrity_exception(*, exception: IntegrityError, user_id: UUID) -> ConflictException:
    if exception.driver_exception.constraint_name == LOCATION_UNIQUE_NAME_INDEX:
        name_exception = NameAlreadyExists(entity=LocationModel, user_id=user_id, logger=logger)
        return name_exception

    integrity_exception = IntegrityException(entity=LocationModel, exception=exception, logger=logger)
    return integrity_exception


async def create_location(*, db: AsyncSession, create_data: LocationCreateRequest, user_id: UUID) -> Location:
    obj_in: LocationCreate = LocationCreate(**create_data.model_dump(), user_id=user_id)
    try:
        location_db: LocationModel = await location_crud.create(db=db, obj_in=obj_in)
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    location: Location = Location.model_validate(location_db)
    return location


async def get_locations(*, db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
    recent_use_dates: tuple[date, date] = utils.get_recent_use_dates(today=datetime.now(UTC).date())
    locations_db: Page[LocationModel] = await location_crud.get_locations(
        db=db, request=request, user_id=user_id, recent_use_dates=recent_use_dates
    )
    locations: Page[Location] = Page[Location].model_validate(locations_db)
    return locations


async def get_location(*, db: AsyncSession, location_id: UUID, user_id: UUID) -> Location:
    location_db: LocationModel | None = await location_crud.get_or_none(
        db=db, id=location_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )

    if location_db is None:
        raise EntityNotFound(entity=LocationModel, search_params={"id": location_id, "user_id": user_id}, logger=logger)

    location: Location = Location.model_validate(location_db)
    return location


async def update_location(
    *, db: AsyncSession, location_id: UUID, update_data: LocationUpdate, user_id: UUID
) -> Location:
    try:
        location_db: LocationModel | None = await location_crud.update_orm(
            db=db, obj_in=update_data, id=location_id, user_id=user_id, status=EntityStatusType.ACTIVE
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    if location_db is None:
        raise EntityNotFound(entity=LocationModel, search_params={"id": location_id, "user_id": user_id}, logger=logger)

    location: Location = Location.model_validate(location_db)
    return location


async def delete_location(*, db: AsyncSession, location_id: UUID, user_id: UUID) -> Location:
    obj_in: dict = {"status": EntityStatusType.DELETED.value}
    location_db: LocationModel | None = await location_crud.update_orm(
        db=db, obj_in=obj_in, id=location_id, user_id=user_id, status=EntityStatusType.ACTIVE
    )

    if location_db is None:
        raise EntityNotFound(entity=LocationModel, search_params={"id": location_id, "user_id": user_id}, logger=logger)

    location: Location = Location.model_validate(location_db)
    return location


async def restore_location(*, db: AsyncSession, location_id: UUID, user_id: UUID) -> Location:
    obj_in: dict = {"status": EntityStatusType.ACTIVE.value}
    try:
        location_db: LocationModel | None = await location_crud.update_orm(
            db=db, obj_in=obj_in, id=location_id, user_id=user_id, status=EntityStatusType.DELETED
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    if location_db is None:
        raise EntityNotFound(entity=LocationModel, search_params={"id": location_id, "user_id": user_id}, logger=logger)

    location: Location = Location.model_validate(location_db)
    return location
