from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, Enum, func, Numeric, String, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base
from app.schemas.base import CurrencyType
from app.schemas.transaction.account import AccountType


class Account(Base):
    __tablename__ = 'accounts'
    __table_args__ = (UniqueConstraint('user_id', 'currency', 'account_type',
                                       name='account_unique_user_id_currency_account_type'),)

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=text('gen_random_uuid()'))  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(4096), nullable=True)

    balance: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default='0')
    currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType,
                                                        native_enum=False,
                                                        validate_strings=True,
                                                        values_callable=lambda x: [i.value for i in x]),
                                                   nullable=False)
    base_currency_rate: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType,
                                                           native_enum=False,
                                                           validate_strings=True,
                                                           values_callable=lambda x: [i.value for i in x]),
                                                      nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)
