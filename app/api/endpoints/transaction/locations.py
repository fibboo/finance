from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_user_id, get_db_transaction
from app.schemas.transaction.location import Location, LocationCreate, LocationUpdate, LocationRequest
from app.services.transaction import location_service

router = APIRouter()


@router.post('')
async def create_location(place_create: LocationCreate,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db)) -> Location:
    location: Location = await location_service.create_location(db=db, location_create=place_create, user_id=user_id)
    return location


@router.get('')
async def get_locations(location_request: LocationRequest,
                        user_id: UUID = Depends(get_user_id),
                        db: AsyncSession = Depends(get_db_transaction)) -> Page[Location]:
    locations: Page[Location] = await location_service.get_locations(db=db, request=location_request, user_id=user_id)
    return locations


@router.get('/{location_id}')
async def get_location_by_id(location_id: UUID,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db_transaction)) -> Location:
    location: Location = await location_service.get_location_by_id(db=db, location_id=location_id, user_id=user_id)
    return location


@router.put('/{location_id}')
async def update_location(location_id: UUID,
                          body: LocationUpdate,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db_transaction)) -> Location:
    location: Location = await location_service.update_location(db=db,
                                                                location_id=location_id,
                                                                request=body,
                                                                user_id=user_id)
    return location


@router.delete('/{location_id}', status_code=200)
async def delete_location(location_id: UUID,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db_transaction)) -> None:
    await location_service.delete_location(db=db, location_id=location_id, user_id=user_id)
