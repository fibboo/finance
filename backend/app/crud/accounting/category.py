from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.category import Category
from app.schemas.accounting.category import CategoryCreateRequest, CategoryRequest, CategoryUpdate
from app.schemas.base import EntityStatusType


class CRUDCategory(CRUDBase[Category, CategoryCreateRequest, CategoryUpdate]):
    async def get_categories(self, *, db: AsyncSession, request: CategoryRequest, user_id: UUID) -> Page[Category]:
        query = (
            select(self.model)
            .where(self.model.user_id == user_id, self.model.status == EntityStatusType.ACTIVE)
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

        if len(request.types) > 0:
            types: list[str] = [category_type.value for category_type in request.types]
            query = query.where(self.model.type.in_(types))

        paginated_categories = await apaginate(db, query, request)
        return paginated_categories


category_crud = CRUDCategory(model=Category)
