from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, func, String
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.user.user import User
from app.schemas.user.external_user import ProviderType


class ExternalUser(Base):
    __tablename__ = 'external_users'

    id: Mapped[UUID] = mapped_column(DB_UUID(as_uuid=True), primary_key=True, default=uuid4)  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID(as_uuid=True), ForeignKey(User.id), nullable=False)

    provider: Mapped[ProviderType] = mapped_column(Enum(ProviderType, native_enum=False, validate_strings=True,
                                                        values_callable=lambda x: [i.value for i in x]),
                                                   nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String, nullable=False, index=True)
    first_name: Mapped[str | None] = mapped_column(String, nullable=True)
    last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar: Mapped[str | None] = mapped_column(String, nullable=True)
    profile_url: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
