from typing import Any, Generic, Type, TypeVar

from pydantic import BaseModel
from sqlalchemy import select, Select, update, Update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import ReturningInsert

from app.models.base import Base

Model = TypeVar('Model', bound=Base)
CreateSchema = TypeVar('CreateSchema', bound=BaseModel)
UpdateSchema = TypeVar('UpdateSchema', bound=BaseModel)


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

    async def get(self, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)
        result: Model = (await db.execute(query)).unique().scalar_one()
        return result

    async def get_or_none(self, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model | None:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)

        result: Model | None = (await db.execute(query)).unique().scalar_one_or_none()
        return result

    async def last_or_none(self, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model | None:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)
        query: Select = query.order_by(self.model.created_at.desc())

        result: Model | None = (await db.execute(query)).unique().scalars().first()
        return result

    async def get_batch(self, db: AsyncSession, skip: int = 0, limit: int = 100, **kwargs) -> list[Model]:
        query: Select = self._build_get_query(**kwargs).offset(skip).limit(limit)
        result: list[Model] = (await db.execute(query)).unique().scalars().all()
        return result

    async def create(self,
                     db: AsyncSession,
                     obj_in: CreateSchema | dict[str, Any],
                     flush: bool | None = True,
                     commit: bool | None = False) -> Model:
        obj_data = obj_in
        if isinstance(obj_in, BaseModel):
            obj_data = obj_in.model_dump()

        query: ReturningInsert = insert(self.model).values(obj_data).returning(self.model)
        db_obj: Model = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self,
                     db: AsyncSession,
                     obj_in: UpdateSchema | dict[str, Any],
                     flush: bool | None = True,
                     commit: bool | None = False,
                     **kwargs) -> Model | None:
        obj_data = obj_in
        if isinstance(obj_in, BaseModel):
            obj_data = obj_in.model_dump(exclude_unset=True)

        query: Update = (update(self.model)
                         .where(*[getattr(self.model, k) == v for k, v in kwargs.items()])
                         .values(obj_data)
                         .returning(self.model))
        db_obj: Model | None = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        return db_obj
