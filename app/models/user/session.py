from uuid import uuid4

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Enum, func, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base
from app.schemas.user.external_user import ProviderType


class UserSession(Base):
    __tablename__ = "session"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    expires_at = Column(DateTime, nullable=False)
    provider = Column(Enum(ProviderType, native_enum=False, validate_strings=True,
                           values_callable=lambda x: [i.value for i in x]),
                      nullable=False, index=True)

    access_token = Column(String, nullable=True)
    token_type = Column(String, nullable=True)
    expires_in = Column(BigInteger, nullable=True)
    refresh_token = Column(String, nullable=True)
    scope = Column(String, nullable=True)

    user = relationship('User', lazy='selectin')

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
