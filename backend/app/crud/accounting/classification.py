from uuid import UUID

from sqlalchemy import and_, func, literal, select, Select
from sqlalchemy.dialects.postgresql import insert, Insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.crud.base import CRUDBase
from app.models.accounting.classification import Classification
from app.schemas.accounting.classification import ClassificationKind, ClassificationNameRequest


class CRUDClassification(CRUDBase[Classification, ClassificationNameRequest, ClassificationNameRequest]):
    async def get_user_classifications(
        self, *, db: AsyncSession, user_id: UUID, kind: ClassificationKind | None = None
    ) -> list[Classification]:
        query: Select = select(self.model).where(self.model.user_id == user_id)

        if kind is not None:
            query = query.where(self.model.kind == kind)

        query = query.order_by(self.model.kind, self.model.is_default.desc(), func.lower(self.model.name))
        classifications: list[Classification] = list(await db.scalars(query))
        return classifications

    async def copy_for_merge(self, *, db: AsyncSession, user_id: UUID, merge_user_id: UUID) -> dict[UUID, UUID]:
        source = aliased(self.model)
        source_types: Select = select(literal(user_id), source.kind, source.name).where(source.user_id == merge_user_id)
        copy_types: Insert = (
            insert(self.model)
            .from_select(["user_id", "kind", "name"], source_types)
            .on_conflict_do_nothing(index_elements=[self.model.user_id, self.model.kind, func.lower(self.model.name)])
        )
        await db.execute(copy_types)
        await db.flush()

        mappings: Select = (
            select(source.id, self.model.id)
            .join(
                self.model,
                and_(
                    self.model.user_id == user_id,
                    self.model.kind == source.kind,
                    func.lower(self.model.name) == func.lower(source.name),
                ),
            )
            .where(source.user_id == merge_user_id)
        )
        classification_ids: dict[UUID, UUID] = {
            source_id: target_id for source_id, target_id in (await db.execute(mappings))
        }
        return classification_ids


classification_crud = CRUDClassification(model=Classification)
