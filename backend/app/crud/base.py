from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import delete, select, Select, update, Update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base


class CRUDBase[Model: Base, CreateSchema: BaseModel, UpdateSchema: BaseModel]:
    def __init__(self, *, model: type[Model]):
        self.model = model

    def _build_get_query(self, *, with_for_update: bool = False, **kwargs) -> Select:
        query: Select = select(self.model).where(*[getattr(self.model, k) == v for k, v in kwargs.items()])

        if with_for_update:
            query = query.with_for_update()

        return query

    async def get(self, *, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)
        result: Model = (await db.execute(query)).unique().scalar_one()
        return result

    async def get_or_none(self, *, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model | None:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)

        result: Model | None = (await db.execute(query)).unique().scalar_one_or_none()
        return result

    async def last_or_none(self, *, db: AsyncSession, with_for_update: bool | None = False, **kwargs) -> Model | None:
        query: Select = self._build_get_query(with_for_update=with_for_update, **kwargs)
        query: Select = query.order_by(self.model.created_at.desc())

        result: Model | None = (await db.execute(query)).unique().scalars().first()
        return result

    async def get_batch(self, *, db: AsyncSession, skip: int = 0, limit: int = 100, **kwargs) -> list[Model]:
        query: Select = self._build_get_query(**kwargs).offset(skip).limit(limit)
        result: list[Model] = (await db.execute(query)).unique().scalars().all()
        return result

    async def create(
        self,
        *,
        db: AsyncSession,
        obj_in: CreateSchema | dict[str, Any],
        flush: bool | None = True,
        commit: bool | None = False,
    ) -> Model:
        obj_data = obj_in
        if isinstance(obj_in, BaseModel):
            obj_data = obj_in.model_dump(exclude_unset=True)

        db_obj: Model = self.model(**obj_data)
        db.add(db_obj)
        if flush:
            await db.flush()
        if commit:
            await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def create_batch(
        self,
        *,
        db: AsyncSession,
        objs_in: list[CreateSchema] | list[dict[str, Any]],
        flush: bool | None = True,
        commit: bool | None = False,
    ) -> list[Model]:
        objs_data: list[dict[str, Any]] = []
        for obj_in in objs_in:
            obj_data = obj_in
            if isinstance(obj_in, BaseModel):
                obj_data = obj_in.model_dump(exclude_unset=True)
            objs_data.append(obj_data)

        db_objs: list[Model] = [self.model(**obj_data) for obj_data in objs_data]
        db.add_all(db_objs)
        if flush:
            await db.flush()
        if commit:
            await db.commit()
        for db_obj in db_objs:
            await db.refresh(db_obj)

        return db_objs

    async def update_orm(
        self,
        *,
        db: AsyncSession,
        obj_in: UpdateSchema | dict[str, Any],
        flush: bool | None = True,
        commit: bool | None = False,
        **kwargs,
    ) -> Model | None:
        obj_data = obj_in
        if isinstance(obj_in, BaseModel):
            obj_data = obj_in.model_dump(exclude_unset=True)

        query: Update = (
            update(self.model)
            .where(*[getattr(self.model, k) == v for k, v in kwargs.items()])
            .values(obj_data)
            .returning(self.model)
        )
        db_obj: Model | None = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        return db_obj

    async def update_api(
        self,
        *,
        db: AsyncSession,
        db_obj: Model,
        obj_in: UpdateSchema | dict[str, Any],
        flush: bool | None = True,
        commit: bool | None = False,
    ) -> Model:
        obj_data: dict[str, Any] = jsonable_encoder(db_obj)
        update_data: dict[str, Any] = obj_in
        if isinstance(obj_in, BaseModel):
            update_data = obj_in.model_dump(exclude_unset=True)

        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])

        db.add(db_obj)
        if flush:
            await db.flush()
        if commit:
            await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete_by_ids(self, *, db: AsyncSession, ids: list[UUID]) -> None:
        await db.execute(delete(self.model).where(self.model.id.in_(ids)))
        await db.flush()

    async def move_to_user(self, *, db: AsyncSession, user_id: UUID, new_user_id: UUID) -> None:
        query: Update = update(self.model).where(self.model.user_id == user_id).values(user_id=new_user_id)
        await db.execute(query)
        await db.flush()
