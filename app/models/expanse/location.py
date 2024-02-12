from uuid import uuid4

from sqlalchemy import Column, UUID, DateTime, func, String, Enum, UniqueConstraint

from app.db import Base
from app.schemas.base import EntityStatusType


class Location(Base):
    __tablename__ = 'locations'
    __table_args__ = (UniqueConstraint('user_id', 'name', 'status', name='place_unique_user_id_name_status'),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    name = Column(String(64), nullable=False, index=True)
    description = Column(String(4096), nullable=True)
    coordinates = Column(String(64), nullable=True, unique=True)
    status = Column(Enum(EntityStatusType, native_enum=False, validate_strings=True,
                         values_callable=lambda x: [i.value for i in x]),
                    nullable=False, index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
