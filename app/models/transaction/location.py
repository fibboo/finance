from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, func, String, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.schemas.base import EntityStatusType


class Location(Base):
    __tablename__ = 'locations'
    __table_args__ = (UniqueConstraint('user_id', 'name', 'status', name='place_unique_user_id_name_status'),)

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=text('gen_random_uuid()'))  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    coordinates: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    status: Mapped[EntityStatusType] = mapped_column(Enum(EntityStatusType,
                                                          native_enum=False,
                                                          validate_strings=True,
                                                          values_callable=lambda x: [i.value for i in x]),
                                                     nullable=False,
                                                     server_default=EntityStatusType.ACTIVE.value,
                                                     index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
