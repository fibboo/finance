from uuid import uuid4

from sqlalchemy import Column, UUID, ForeignKey, String, Enum, DateTime, func

from app.db import Base
from app.schemas.user.external_user import ProviderType


class ExternalUser(Base):
    __tablename__ = 'external_users'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    provider = Column(Enum(ProviderType, native_enum=False, validate_strings=True,
                           values_callable=lambda x: [i.value for i in x]),
                      nullable=False, index=True)
    external_id = Column(String, nullable=False, index=True)
    username = Column(String, nullable=False, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    profile_url = Column(String, nullable=True)
    email = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
