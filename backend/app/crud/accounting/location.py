from datetime import datetime, UTC
from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import func, or_, select, Select, Subquery
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.location import Location
from app.models.accounting.transaction import Transaction
from app.schemas.accounting.location import LocationCreateRequest, LocationRequest, LocationUpdate
from app.schemas.base import EntityStatusType, ListOrderType
from app.utils import utils


class CRUDLocation(CRUDBase[Location, LocationCreateRequest, LocationUpdate]):
    async def get_locations(self, *, db: AsyncSession, request: LocationRequest, user_id: UUID) -> Page[Location]:
        query: Select = select(self.model).where(self.model.user_id == user_id, self.model.status.in_(request.statuses))

        if request.search_term is not None:
            query = query.where(
                or_(
                    self.model.name.icontains(request.search_term, autoescape=True),
                    self.model.description.icontains(request.search_term, autoescape=True),
                )
            )

        if request.order == ListOrderType.RECENT_USE:
            recent_use_start, recent_use_end = utils.get_recent_use_dates(today=datetime.now(UTC).date())
            use_counts: Subquery = (
                select(Transaction.location_id, func.count(Transaction.id).label("use_count"))
                .where(
                    Transaction.user_id == user_id,
                    Transaction.status == EntityStatusType.ACTIVE,
                    Transaction.transaction_date.between(recent_use_start, recent_use_end),
                )
                .group_by(Transaction.location_id)
                .subquery()
            )
            query = query.outerjoin(use_counts, use_counts.c.location_id == self.model.id).order_by(
                func.coalesce(use_counts.c.use_count, 0).desc()
            )

        query = query.order_by(self.model.name, self.model.id)
        paginated_expenses = await apaginate(db, query, request)
        return paginated_expenses

    async def get_user_locations(self, *, db: AsyncSession, user_id: UUID) -> list[Location]:
        query: Select = select(self.model).where(self.model.user_id == user_id).order_by(self.model.id)
        locations: list[Location] = (await db.scalars(query)).all()
        return locations


location_crud = CRUDLocation(model=Location)
