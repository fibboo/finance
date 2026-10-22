from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func, Index, String, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.accounting.currency import Currency
from app.models.base import Base
from app.schemas.user.external_user import ProviderType

USERNAME_LOWER_INDEX = "uq_users_username_lower"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(UUID, primary_key=True, server_default=func.uuidv7(monotonic=True))  # noqa: A003

    username: Mapped[str] = mapped_column(String(64), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(2560), nullable=True)
    registration_provider: Mapped[ProviderType] = mapped_column(
        Enum(ProviderType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=False,
    )
    base_currency: Mapped[str | None] = mapped_column(String(3), ForeignKey(Currency.code), nullable=True)

    external_users: Mapped[list["ExternalUser"]] = relationship("ExternalUser", lazy="joined")  # noqa: F821

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


Index(USERNAME_LOWER_INDEX, func.lower(User.username), unique=True)
