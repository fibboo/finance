from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, func, String, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IncomeSource(Base):
    __tablename__ = 'income_sources'
    __table_args__ = (UniqueConstraint('user_id', 'name', name='location_unique_user_id_name'),)

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=text('gen_random_uuid()'))  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(4096), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)

    def __repr__(self):
        return f'<IncomeSource (id={self.id}, name={self.name})>'
