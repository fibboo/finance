from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, func, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.schemas.base import EntityStatusType

LOCATION_UNIQUE_NAME_INDEX = "location_unique_user_id_name"


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        Index(
            LOCATION_UNIQUE_NAME_INDEX,
            "user_id",
            "name",
            unique=True,
            postgresql_where=text(f"status = '{EntityStatusType.ACTIVE.value}'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(  # noqa: A003
        DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True)
    )
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    status: Mapped[EntityStatusType] = mapped_column(
        Enum(
            EntityStatusType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]
        ),
        nullable=False,
        server_default=EntityStatusType.ACTIVE.value,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self):
        return f"<Location (id={self.id}, name={self.name})>"
