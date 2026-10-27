from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import or_, select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.location import Location
from app.schemas.accounting.location import LocationCreateRequest, LocationRequest, LocationUpdate


class CRUDLocation(CRUDBase[Location, LocationCreateRequest, LocationUpdate]):
    async def get_locations(self, *, db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
        query = (
            select(self.model)
            .where(self.model.user_id == user_id, self.model.status.in_(request.statuses))
            .order_by(self.model.name)
            .order_by(self.model.id)
        )

        if request.search_term is not None:
            query = query.where(
                or_(
                    self.model.name.icontains(request.search_term, autoescape=True),
                    self.model.description.icontains(request.search_term, autoescape=True),
                )
            )

        paginated_expenses = await apaginate(db, query, request)
        return paginated_expenses

    async def get_user_locations(self, *, db: AsyncSession, user_id: UUID) -> list[Location]:
        query: Select = select(self.model).where(self.model.user_id == user_id).order_by(self.model.id)
        locations: list[Location] = (await db.scalars(query)).all()
        return locations


location_crud = CRUDLocation(model=Location)
