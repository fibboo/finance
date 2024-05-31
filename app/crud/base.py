from typing import Any, Generic, Optional, Type, TypeVar
from uuid import UUID

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base
from app.schemas.base import BaseServiceModel


ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseServiceModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseServiceModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).

        **Parameters**

        * `model`: A SQLAlchemy model class
        * `schema`: A Pydantic model (schema) class
        """

        self.model = model

    async def get(self,
                  db: AsyncSession,
                  id: Any,
                  user_id: Optional[UUID] = None,
                  with_for_update: Optional[bool] = False) -> Optional[ModelType]:
        query = select(self.model).where(self.model.id == id)

        if user_id is not None:
            query = query.where(self.model.user_id == user_id)

        if with_for_update:
            query = query.with_for_update()

        result: Optional[ModelType] = await db.scalar(query)
        return result

    async def get_by_ids(self,
                         db: AsyncSession,
                         ids: list[Any],
                         user_id: Optional[UUID] = None,
                         limit: Optional[int] = None) -> list[ModelType]:
        query = select(self.model).where(self.model.id.in_(ids))

        if user_id is not None:
            query = query.where(self.model.user_id == user_id)

        if limit is not None:
            query = query.limit(limit)

        result: list[ModelType] = (await db.scalars(query)).all()
        return result

    async def get_batch(self,
                        db: AsyncSession,
                        user_id: Optional[UUID] = None) -> list[ModelType]:
        query = select(self.model)

        if user_id is not None:
            query = query.where(self.model.user_id == user_id)

        result: list[ModelType] = (await db.scalars(query)).all()
        return result

    async def create(self,
                     db: AsyncSession,
                     obj_in: CreateSchemaType | dict[str, Any] | ModelType,
                     flush: Optional[bool] = True,
                     commit: Optional[bool] = False) -> ModelType:
        if isinstance(obj_in, BaseServiceModel):
            obj_data = obj_in.model_dump()
        elif isinstance(obj_in, Base):
            obj_data = obj_in.__dict__
            obj_data.pop('_sa_instance_state', None)
        else:
            obj_data = obj_in

        query = insert(self.model).values(obj_data).returning(self.model)
        db_obj: ModelType = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self,
                     db: AsyncSession,
                     id: Any,
                     obj_in: UpdateSchemaType | dict[str, Any] | ModelType,
                     user_id: Optional[UUID] = None,
                     flush: Optional[bool] = True,
                     commit: Optional[bool] = False) -> Optional[ModelType]:
        if isinstance(obj_in, BaseServiceModel):
            obj_data = obj_in.model_dump()
        elif isinstance(obj_in, Base):
            obj_data = obj_in.__dict__
            obj_data.pop('_sa_instance_state', None)
        else:
            obj_data = obj_in

        query = update(self.model).filter_by(id=id, user_id=user_id).values(obj_data).returning(self.model)
        db_obj: Optional[ModelType] = await db.scalar(query)

        if flush:
            await db.flush()
        if commit:
            await db.commit()
        return db_obj
