from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.transaction.location import Location
from app.schemas.transaction.location import LocationCreateRequest, LocationUpdate, LocationRequest


class CRUDLocation(CRUDBase[Location, LocationCreateRequest, LocationUpdate]):
    async def get_locations(self, db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
        query = (select(self.model)
                 .where(self.model.user_id == user_id)
                 .order_by(self.model.name)
                 .order_by(self.model.id)
                 .limit(20))

        if request.search_term is not None:
            query = query.where(or_(self.model.name.ilike(f'%{request.search_term}%'),
                                    self.model.description.ilike(f'%{request.search_term}%')))

        paginated_expenses = await paginate(db, query, request)
        return paginated_expenses


location_crud = CRUDLocation(Location)
