from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Enum, ForeignKey, func, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.expense.category import Category
from app.models.expense.location import Location
from app.schemas.base import CurrencyType, EntityStatusType


class Expense(Base):
    __tablename__ = 'expenses'

    id: Mapped[UUID] = mapped_column(DB_UUID(as_uuid=True), primary_key=True, default=uuid4)  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID(as_uuid=True), nullable=False, index=True)

    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False, index=True)
    original_amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False, index=True)
    original_currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType, native_enum=False, validate_strings=True,
                                                                 values_callable=lambda x: [i.value for i in x]),
                                                            nullable=False, index=True)

    comment: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    category_id: Mapped[UUID] = mapped_column(DB_UUID(as_uuid=True), ForeignKey('categories.id'), nullable=False,
                                              index=True)
    location_id: Mapped[UUID] = mapped_column(DB_UUID(as_uuid=True), ForeignKey('locations.id'), nullable=False)
    status: Mapped[EntityStatusType] = mapped_column(Enum(EntityStatusType, native_enum=False, validate_strings=True,
                                                          values_callable=lambda x: [i.value for i in x]),
                                                     nullable=False, index=True)

    category: Mapped[Category] = relationship(Category, lazy='selectin')
    location: Mapped[Location] = relationship(Location, lazy='selectin')

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
