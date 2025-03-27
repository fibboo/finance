from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_db_transaction, get_user_id
from app.schemas.accounting.income_source import (IncomeSource, IncomeSourceCreateRequest, IncomeSourceRequest,
                                                  IncomeSourceUpdate)
from app.services.accounting import income_service

router = APIRouter()


@router.post('')
async def create_income_source(create_data: IncomeSourceCreateRequest,
                               user_id: UUID = Depends(get_user_id),
                               db: AsyncSession = Depends(get_db_transaction)) -> IncomeSource:
    income_source: IncomeSource = await income_service.create_income_source(db=db,
                                                                            create_data=create_data,
                                                                            user_id=user_id)
    return income_source


@router.get('')
async def get_income_sources(request: IncomeSourceRequest = Depends(),
                             user_id: UUID = Depends(get_user_id),
                             db: AsyncSession = Depends(get_db)) -> Page[IncomeSource]:
    income_sources: Page[IncomeSource] = await income_service.get_income_sources(db=db,
                                                                                 request=request,
                                                                                 user_id=user_id)
    return income_sources


@router.get('/{income_source_id}')
async def get_income_source(income_source_id: UUID,
                            user_id: UUID = Depends(get_user_id),
                            db: AsyncSession = Depends(get_db)) -> IncomeSource:
    income_source: IncomeSource = await income_service.get_income_source(db=db,
                                                                         income_source_id=income_source_id,
                                                                         user_id=user_id)
    return income_source


@router.put('/{income_source_id}')
async def update_income_source(income_source_id: UUID,
                               update_data: IncomeSourceUpdate,
                               user_id: UUID = Depends(get_user_id),
                               db: AsyncSession = Depends(get_db)) -> IncomeSource:
    income_source: IncomeSource = await income_service.update_income_source(db=db,
                                                                            income_source_id=income_source_id,
                                                                            update_data=update_data,
                                                                            user_id=user_id)
    return income_source
