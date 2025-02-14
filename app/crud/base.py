from typing import Any, Generic, Type, TypeVar
from uuid import UUID

from sqlalchemy import insert, select, Select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base
from app.schemas.base import BaseServiceModel


Model = TypeVar('Model', bound=Base)
CreateSchema = TypeVar('CreateSchema', bound=BaseServiceModel)
UpdateSchema = TypeVar('UpdateSchema', bound=BaseServiceModel)


class CRUDBase(Generic[Model, CreateSchema, UpdateSchema]):
    def __init__(self, model: Type[Model]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).

        **Parameters**

        * `model`: A SQLAlchemy model class
        * `schema`: A Pydantic model (schema) class
        """

        self.model = model

    def _build_get_query(self, with_for_update: bool = False, **kwargs) -> Select:
        query: Select = select(self.model).where(*[getattr(self.model, k) == v for k, v in kwargs.items()])

        if with_for_update:
            query = query.with_for_update()

        return query

    async def get_or_none(self, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model | None:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)

        result: Model | None = (await db.execute(query)).unique().scalar_one_or_none()
        return result

    async def last_or_none(self, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model | None:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)
        query: Select = query.order_by(self.model.created_at.desc())

        result: Model | None = (await db.execute(query)).unique().scalars().first()
        return result

    async def get(self, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)
        result: Model = (await db.execute(query)).unique().scalar_one()
        return result

    async def get_by_ids(self,
                         db: AsyncSession,
                         ids: list[Any],
                         user_id: UUID | None = None,
                         limit: int | None = None) -> list[Model]:
        query = select(self.model).where(self.model.id.in_(ids))

        if user_id is not None:
            query = query.where(self.model.user_id == user_id)

        if limit is not None:
            query = query.limit(limit)

        result: list[Model] = (await db.scalars(query)).all()
        return result

    async def get_batch(self,
                        db: AsyncSession,
                        user_id: UUID | None = None) -> list[Model]:
        query = select(self.model)

        if user_id is not None:
            query = query.where(self.model.user_id == user_id)

        result: list[Model] = (await db.scalars(query)).all()
        return result

    async def create(self,
                     db: AsyncSession,
                     obj_in: CreateSchema | dict[str, Any] | Model,
                     flush: bool | None = True,
                     commit: bool | None = False) -> Model:
        if isinstance(obj_in, BaseServiceModel):
            obj_data = obj_in.model_dump()
        elif isinstance(obj_in, Base):
            obj_data = obj_in.__dict__
            obj_data.pop('_sa_instance_state', None)
        else:
            obj_data = obj_in

        query = insert(self.model).values(obj_data).returning(self.model)
        db_obj: Model = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self,
                     db: AsyncSession,
                     id: Any,  # noqa: A002
                     obj_in: UpdateSchema | dict[str, Any] | Model,
                     user_id: UUID | None = None,
                     flush: bool | None = True,
                     commit: bool | None = False) -> Model | None:
        if isinstance(obj_in, BaseServiceModel):
            obj_data = obj_in.model_dump()
        elif isinstance(obj_in, Base):
            obj_data = obj_in.__dict__
            obj_data.pop('_sa_instance_state', None)
        else:
            obj_data = obj_in

        query = update(self.model).filter_by(id=id, user_id=user_id).values(obj_data).returning(self.model)
        db_obj: Model | None = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        return db_obj
