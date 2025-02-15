from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Enum, func, String, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType


class User(Base):
    __tablename__ = 'users'

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)  # noqa: A003

    username: Mapped[str] = mapped_column(String(64), nullable=False, index=True, unique=True)
    avatar: Mapped[str | None] = mapped_column(String(2560), nullable=True)
    registration_provider: Mapped[ProviderType] = mapped_column(Enum(ProviderType,
                                                                     native_enum=False,
                                                                     validate_strings=True,
                                                                     values_callable=lambda x: [i.value for i in x]),
                                                                nullable=False)
    base_currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType, native_enum=False, validate_strings=True,
                                                             values_callable=lambda x: [i.value for i in x]),
                                                        nullable=False, server_default=CurrencyType.USD.value)

    external_users: Mapped[list['ExternalUser']] = relationship('ExternalUser', lazy='joined')  # noqa: F821

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
