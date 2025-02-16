from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, func, String, text
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user.user import User
from app.schemas.user.external_user import ProviderType


class UserSession(Base):
    __tablename__ = 'session'

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=text('gen_random_uuid()'))  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(User.id), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    provider: Mapped[ProviderType] = mapped_column(Enum(ProviderType, native_enum=False, validate_strings=True,
                                                        values_callable=lambda x: [i.value for i in x]),
                                                   nullable=False, index=True)

    access_token: Mapped[str | None] = mapped_column(String, nullable=True)
    token_type: Mapped[str | None] = mapped_column(String, nullable=True)
    expires_in: Mapped[str | None] = mapped_column(BigInteger, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)
    scope: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped[User] = relationship(User, lazy='joined')

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
