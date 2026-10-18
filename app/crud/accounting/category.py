from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.category import Category
from app.schemas.accounting.category import CategoryCreateRequest, CategoryRequest, CategoryUpdate


class CRUDCategory(CRUDBase[Category, CategoryCreateRequest, CategoryUpdate]):
    async def get_categories(self, *, db: AsyncSession, request: CategoryRequest, user_id: UUID) -> Page[Category]:
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

        paginated_categories = await apaginate(db, query, request)
        return paginated_categories


category_crud = CRUDCategory(model=Category)
