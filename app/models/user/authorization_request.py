from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, false, ForeignKey, func, String
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.user.user import User
from app.schemas.user.external_user import ProviderType


class AuthorizationRequest(Base):
    __tablename__ = "authorization_requests"

    id: Mapped[UUID] = mapped_column(  # noqa: A003
        DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True)
    )
    provider: Mapped[ProviderType] = mapped_column(
        Enum(ProviderType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=False,
    )

    state: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    nonce: Mapped[str] = mapped_column(String, nullable=False)
    provider_code_verifier: Mapped[str] = mapped_column(String, nullable=False)
    client_redirect_uri: Mapped[str] = mapped_column(String, nullable=False)
    client_state: Mapped[str] = mapped_column(String, nullable=False)
    client_code_challenge: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    link_user_id: Mapped[UUID | None] = mapped_column(DB_UUID, ForeignKey(User.id), nullable=True)

    user_id: Mapped[UUID | None] = mapped_column(DB_UUID, ForeignKey(User.id), nullable=True, index=True)
    code_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false())

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
