from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id, get_db
from app.schemas.expense.location import Location, LocationCreate, LocationUpdate, LocationRequest
from app.services.expense import location_service

router = APIRouter()


@router.post('', response_model=Location)
async def create_location(place_create: LocationCreate,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db)):
    location: Location = await location_service.create_location(db=db, location_create=place_create, user_id=user_id)
    return location


@router.post('/list', response_model=Page[Location])
async def get_locations(body: LocationRequest,
                        user_id: UUID = Depends(get_user_id),
                        db: AsyncSession = Depends(get_db)):
    locations: Page[Location] = await location_service.get_locations(db=db, request=body, user_id=user_id)
    return locations


@router.get('/{location_id}', response_model=Location)
async def get_location_by_id(location_id: UUID,
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db)):
    location: Location = await location_service.get_location_by_id(db=db, location_id=location_id, user_id=user_id)
    return location


@router.put('/{location_id}', response_model=Location)
async def update_location(location_id: UUID,
                          body: LocationUpdate,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db)):
    location: Location = await location_service.update_location(db=db,
                                                                location_id=location_id,
                                                                request=body,
                                                                user_id=user_id)
    return location


@router.delete('/{location_id}', status_code=200)
async def delete_location(location_id: UUID,
                          user_id: UUID = Depends(get_user_id),
                          db: AsyncSession = Depends(get_db)):
    location: Location = await location_service.delete_location(db=db, location_id=location_id, user_id=user_id)
    return location
