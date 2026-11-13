from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_db, get_onboarded_user_id, get_user_id
from app.schemas.accounting.location import (
    Location,
    LocationCreateRequest,
    LocationRequest,
    LocationRestoreRequest,
    LocationUpdate,
)
from app.services.accounting import location_service

router = APIRouter()


@router.post("")
async def create_location(
    *,
    create_data: LocationCreateRequest,
    user_id: UUID = Depends(get_onboarded_user_id),
    db: DbTransaction,
) -> Location:
    location: Location = await location_service.create_location(db=db, create_data=create_data, user_id=user_id)
    return location


@router.get("")
async def get_locations(
    *,
    request: Annotated[LocationRequest, Query()],
    user_id: UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
) -> Page[Location]:
    locations: Page[Location] = await location_service.get_locations(db=db, request=request, user_id=user_id)
    return locations


@router.get("/{location_id}")
async def get_location_by_id(
    *, location_id: UUID, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> Location:
    location: Location = await location_service.get_location(db=db, location_id=location_id, user_id=user_id)
    return location


@router.put("/{location_id}")
async def update_location(
    *,
    location_id: UUID,
    update_data: LocationUpdate,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Location:
    location: Location = await location_service.update_location(
        db=db, location_id=location_id, update_data=update_data, user_id=user_id
    )
    return location


@router.delete("/{location_id}")
async def delete_location(*, location_id: UUID, user_id: UUID = Depends(get_user_id), db: DbTransaction) -> Location:
    location: Location = await location_service.delete_location(db=db, location_id=location_id, user_id=user_id)
    return location


@router.post("/{location_id}/restore")
async def restore_location(
    *,
    location_id: UUID,
    restore_data: LocationRestoreRequest | None = None,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Location:
    """
    Restores the location under `name` if given, else its own name; no active location may hold that name
    """
    location: Location = await location_service.restore_location(
        db=db, location_id=location_id, restore_data=restore_data, user_id=user_id
    )
    return location
