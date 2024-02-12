from uuid import uuid4

from sqlalchemy import Column, UUID, DateTime, func, Numeric, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.db import Base
from app.schemas.base import EntityStatusType, CurrencyType


class Expense(Base):
    __tablename__ = 'expenses'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    expense_date = Column(DateTime, nullable=False, index=True)

    amount = Column(Numeric, nullable=False, index=True)
    original_amount = Column(Numeric, nullable=False, index=True)
    original_currency = Column(Enum(CurrencyType, native_enum=False, validate_strings=True,
                                    values_callable=lambda x: [i.value for i in x]),
                               nullable=False, index=True)

    comment = Column(String(256), nullable=True, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id'), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey('locations.id'), nullable=False)
    status = Column(Enum(EntityStatusType, native_enum=False, validate_strings=True,
                         values_callable=lambda x: [i.value for i in x]),
                    nullable=False, index=True)

    category = relationship('Category', lazy='selectin')
    location = relationship('Location', lazy='selectin')

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
