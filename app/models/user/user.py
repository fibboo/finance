from uuid import uuid4

from sqlalchemy import Column, UUID, String, DateTime, func, Enum
from sqlalchemy.orm import relationship

from app.db import Base
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    username = Column(String(64), nullable=False, index=True, unique=True)
    avatar = Column(String(2560), nullable=True)
    registration_provider = Column(Enum(ProviderType, native_enum=False, validate_strings=True,
                                        values_callable=lambda x: [i.value for i in x]),
                                   nullable=False)
    base_currency = Column(Enum(CurrencyType, native_enum=False, validate_strings=True,
                                values_callable=lambda x: [i.value for i in x]),
                           nullable=False, server_default=CurrencyType.USD.value)

    external_users = relationship('ExternalUser', lazy='selectin', uselist=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
