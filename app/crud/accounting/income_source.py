from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.transaction import IncomeSource
from app.schemas.accounting.income_source import IncomeSourceCreateRequest, IncomeSourceRequest, IncomeSourceUpdate


class CRUDIncomeSource(CRUDBase[IncomeSource, IncomeSourceCreateRequest, IncomeSourceUpdate]):
    async def get_income_sources(self,
                                 db: AsyncSession,
                                 request: IncomeSourceRequest,
                                 user_id: UUID) -> Page[IncomeSource]:
        query = (select(self.model)
                 .where(self.model.user_id == user_id)
                 .order_by(self.model.name)
                 .order_by(self.model.id)
                 .limit(20))

        if request.search_term is not None:
            query = query.where(or_(self.model.name.ilike(f'%{request.search_term}%'),
                                    self.model.description.ilike(f'%{request.search_term}%')))

        paginated_income_sources = await paginate(db, query, request)
        return paginated_income_sources


income_source_crud = CRUDIncomeSource(IncomeSource)
