from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.transaction.category import Category
from app.schemas.transaction.category import CategoryCreate, CategoryRequest, CategoryUpdate


class CRUDCategory(CRUDBase[Category, CategoryCreate, CategoryUpdate]):
    async def get_categories(self, db: AsyncSession, request: CategoryRequest, user_id: UUID) -> Page[Category]:
        query = (select(self.model)
                 .where(self.model.user_id == user_id)
                 .order_by(self.model.name)
                 .order_by(self.model.id)
                 .limit(20))

        if request.search_term is not None:
            query = query.where(or_(self.model.name.ilike(f'%{request.search_term}%'),
                                    self.model.description.ilike(f'%{request.search_term}%')))

        if len(request.types) > 0:
            types = [t.value for t in request.types]
            query = query.where(self.model.type.in_(types))

        if len(request.statuses) > 0:
            statuses = [s.value for s in request.statuses]
            query = query.where(self.model.status.in_(statuses))

        paginated_expenses = await paginate(db, query, request)
        return paginated_expenses


category_crud = CRUDCategory(Category)
