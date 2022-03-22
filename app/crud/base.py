from datetime import datetime
from typing import Any, Generic, Optional, Type, TypeVar, Union, Dict
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.db import Base
from app.exceptions.exception import NotFoundEntity

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).

        **Parameters**

        * `model`: A SQLAlchemy model class
        * `schema`: A Pydantic model (schema) class
        """

        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        query = db.query(self.model).filter_by(id=id)
        result = query.first()
        return result

    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_batch(self, db: Session, *, objs_in: list[Union[CreateSchemaType, Dict[str, Any]]]) -> list[ModelType]:
        objs_in_data = []
        for obj_in in objs_in:
            obj_in_data = obj_in if isinstance(obj_in, dict) else jsonable_encoder(obj_in)
            objs_in_data.append(obj_in_data)

        result = None
        if 'id' in self.model.__table__.columns.keys():
            expr = insert(self.model).values(objs_in_data).returning(self.model.id)
            result = db.execute(expr).all()
        else:
            expr = insert(self.model).values(objs_in_data)
            db.execute(expr)
        db.commit()

        db_objs = []
        for count, obj_in_data in enumerate(objs_in_data):
            if result:
                obj_in_data["id"] = result[count][0]
            db_obj = self.model(**obj_in_data)
            db_objs.append(db_obj)
        return db_objs

    def update(self, db: Session, *, id: int, obj_in: Union[UpdateSchemaType, Dict[str, Any]]) -> ModelType:
        db_obj = self.get(db=db, id=id)
        if not db_obj:
            raise NotFoundEntity(f'{self.model.__name__} not found by id #{id}')

        obj_data = jsonable_encoder(db_obj)
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.dict(exclude_unset=True, exclude_none=True)
        update_data['updated_at'] = datetime.now()

        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_batch(self, db: Session, *, ids: list[Union[int, UUID]], obj_in: UpdateSchemaType) -> None:
        query = db.query(self.model).filter(self.model.id.in_(ids))
        query.update(obj_in.dict(exclude_unset=True, exclude_none=True))
        db.commit()

    def delete(self, db: Session, *, id: int) -> Optional[ModelType]:
        obj = db.query(self.model).get(id)
        db.delete(obj)
        db.commit()
        return obj
