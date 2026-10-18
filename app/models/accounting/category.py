from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, func, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.schemas.accounting.category import CategoryType


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="category_unique_user_id_name"),)

    id: Mapped[UUID] = mapped_column(  # noqa: A003
        DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True)
    )
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    type: Mapped[CategoryType] = mapped_column(  # noqa: A003
        Enum(CategoryType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self):
        return f"<Category (id={self.id}, name={self.name})>"
