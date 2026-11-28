from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    func,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.schemas.accounting.transaction_import import TransactionImportStatus

OPEN_IMPORT_STATUSES: tuple[TransactionImportStatus, ...] = (TransactionImportStatus.REVIEW,)


class TransactionImport(Base):
    __tablename__ = "transaction_imports"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuidv7(monotonic=True))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32))
    file_name: Mapped[str] = mapped_column(Text)
    file_format: Mapped[str] = mapped_column(String(4))
    file_hash: Mapped[str] = mapped_column(String(64))
    ignored_columns: Mapped[list[str]] = mapped_column(JSONB)
    decisions: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    preview: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    failure: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


Index(
    "transaction_import_one_open_per_user",
    TransactionImport.user_id,
    unique=True,
    postgresql_where=TransactionImport.status.in_(OPEN_IMPORT_STATUSES),
)


class TransactionImportRow(Base):
    __tablename__ = "transaction_import_rows"
    __table_args__ = (UniqueConstraint("import_id", "row_number", name="transaction_import_row_number_unique"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuidv7(monotonic=True))
    import_id: Mapped[UUID] = mapped_column(ForeignKey(TransactionImport.id, ondelete="CASCADE"))
    row_number: Mapped[int] = mapped_column(Integer)

    transaction_type: Mapped[str | None] = mapped_column(String(10))
    transaction_date: Mapped[date | None] = mapped_column(Date)
    from_name: Mapped[str | None] = mapped_column(Text)
    to_name: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[Decimal | None] = mapped_column(Numeric)
    currency: Mapped[str | None] = mapped_column(ForeignKey("currencies.code"))
    to_amount: Mapped[Decimal | None] = mapped_column(Numeric)
    to_currency: Mapped[str | None] = mapped_column(ForeignKey("currencies.code"))
    base_currency_amount: Mapped[Decimal | None] = mapped_column(Numeric)
    income_period: Mapped[date | None] = mapped_column(Date)
    location_name: Mapped[str | None] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(Text)
    errors: Mapped[list[dict[str, str | None]]] = mapped_column(JSONB)
    duplicate_transaction_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("transactions.id", name="transaction_import_row_duplicate_transaction_fk", ondelete="SET NULL")
    )
    duplicate_row_number: Mapped[int | None] = mapped_column(Integer)
    is_kept: Mapped[bool | None] = mapped_column(Boolean)
