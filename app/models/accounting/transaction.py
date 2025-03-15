from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, DateTime, Enum, ForeignKey, func, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.accounting.account import Account
from app.models.accounting.category import Category
from app.models.accounting.location import Location
from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.accounting.transaction import TransactionType


class Transaction(Base):
    __tablename__ = 'transactions'

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=text('gen_random_uuid()'))  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    transaction_amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False, index=True)
    transaction_currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType,
                                                                    native_enum=False,
                                                                    validate_strings=True,
                                                                    values_callable=lambda x: [i.value for i in x]),
                                                               nullable=False)
    original_amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    original_currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType,
                                                                 native_enum=False,
                                                                 validate_strings=True,
                                                                 values_callable=lambda x: [i.value for i in x]),
                                                            nullable=False)

    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType,
                                                                   native_enum=False,
                                                                   validate_strings=True,
                                                                   values_callable=lambda x: [i.value for i in x]),
                                                              nullable=False, index=True)

    status: Mapped[EntityStatusType] = mapped_column(Enum(EntityStatusType,
                                                          native_enum=False,
                                                          validate_strings=True,
                                                          values_callable=lambda x: [i.value for i in x]),
                                                     nullable=False,
                                                     server_default=EntityStatusType.ACTIVE.value,
                                                     index=True)

    from_account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=True, index=True)
    to_account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=True, index=True)

    category_id: Mapped[UUID | None] = mapped_column(DB_UUID, ForeignKey(Category.id), nullable=True, index=True)
    location_id: Mapped[UUID | None] = mapped_column(DB_UUID, ForeignKey(Location.id), nullable=True, index=True)

    comment: Mapped[str | None] = mapped_column(String(256), nullable=True)

    from_account: Mapped[Account | None] = relationship(Account, foreign_keys=[from_account_id], lazy='selectin')
    to_account: Mapped[Account | None] = relationship(Account, foreign_keys=[to_account_id], lazy='selectin')

    category: Mapped[Category | None] = relationship(Category, foreign_keys=[category_id], lazy='selectin')
    location: Mapped[Location | None] = relationship(Location, foreign_keys=[location_id], lazy='selectin')

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
