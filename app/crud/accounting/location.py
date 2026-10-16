from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.location import Location
from app.schemas.accounting.location import LocationCreateRequest, LocationRequest, LocationUpdate


class CRUDLocation(CRUDBase[Location, LocationCreateRequest, LocationUpdate]):
    async def get_locations(self, *, db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
        query = (
            select(self.model).where(self.model.user_id == user_id).order_by(self.model.name).order_by(self.model.id)
        )

        if request.search_term is not None:
            query = query.where(
                or_(
                    self.model.name.ilike(f"%{request.search_term}%"),
                    self.model.description.ilike(f"%{request.search_term}%"),
                )
            )

        paginated_expenses = await apaginate(db, query, request)
        return paginated_expenses


location_crud = CRUDLocation(model=Location)
