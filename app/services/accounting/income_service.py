from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.income_source import income_source_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.income_source import IncomeSource as IncomeSourceModel
from app.schemas.accounting.income_source import (IncomeSource, IncomeSourceCreate, IncomeSourceCreateRequest,
                                                  IncomeSourceRequest, IncomeSourceUpdate)

logger = get_logger(__name__)


async def create_income_source(db: AsyncSession,
                               create_data: IncomeSourceCreateRequest,
                               user_id: UUID) -> IncomeSource:
    obj_in: IncomeSourceCreate = IncomeSourceCreate(**create_data.model_dump(),
                                                    user_id=user_id)
    try:
        income_source_db: IncomeSourceModel = await income_source_crud.create(db=db, obj_in=obj_in)
    except IntegrityError as exc:
        raise IntegrityException(entity=IncomeSourceModel, exception=exc, logger=logger)

    income_source: IncomeSource = IncomeSource.model_validate(income_source_db)
    return income_source


async def get_income_sources(db: AsyncSession, request: IncomeSourceRequest, user_id: UUID) -> Page[IncomeSource]:
    income_sources_db: Page[IncomeSourceModel] = await income_source_crud.get_income_sources(db=db,
                                                                                             request=request,
                                                                                             user_id=user_id)
    income_sources: Page[IncomeSource] = Page[IncomeSource].model_validate(income_sources_db)
    return income_sources


async def get_income_source(db: AsyncSession, income_source_id: UUID, user_id: UUID) -> IncomeSource:
    income_source_db: IncomeSourceModel | None = await income_source_crud.get_or_none(db=db,
                                                                                      id=income_source_id,
                                                                                      user_id=user_id)
    if income_source_db is None:
        raise EntityNotFound(entity=IncomeSourceModel,
                             search_params={'id': income_source_id, 'user_id': user_id},
                             logger=logger)

    income_source: IncomeSource = IncomeSource.model_validate(income_source_db)
    return income_source


async def update_income_source(db: AsyncSession,
                               income_source_id: UUID,
                               update_data: IncomeSourceUpdate,
                               user_id: UUID) -> IncomeSource:
    try:
        income_source_db: IncomeSourceModel | None = await income_source_crud.update(db=db,
                                                                                     obj_in=update_data,
                                                                                     id=income_source_id,
                                                                                     user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=IncomeSourceModel, exception=exc, logger=logger)

    if income_source_db is None:
        raise EntityNotFound(entity=IncomeSourceModel,
                             search_params={'id': income_source_id, 'user_id': user_id},
                             logger=logger)

    income_source: IncomeSource = IncomeSource.model_validate(income_source_db)
    return income_source
