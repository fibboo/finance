from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import delete, or_, select, Select, update, Update
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

    async def delete_by_ids(self, *, db: AsyncSession, ids: list[UUID]) -> None:
        await db.execute(delete(self.model).where(self.model.id.in_(ids)))
        await db.flush()

    async def move_to_user(self, *, db: AsyncSession, user_id: UUID, new_user_id: UUID) -> None:
        query: Update = update(self.model).where(self.model.user_id == user_id).values(user_id=new_user_id)
        await db.execute(query)
        await db.flush()


location_crud = CRUDLocation(model=Location)
