from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, DDL, Enum, event, ForeignKey, func, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.accounting.location import Location
from app.models.accounting.posting import Posting
from app.models.base import Base
from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import EntityStatusType


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint(
            f"(location_id IS NOT NULL) = (transaction_type = '{TransactionType.EXPENSE.value}')",
            name="transaction_location_by_type",
        ),
        CheckConstraint(
            f"(income_period IS NOT NULL) = (transaction_type = '{TransactionType.INCOME.value}')",
            name="transaction_income_period_by_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(  # noqa: A003
        DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True)
    )
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=False,
        index=True,
    )
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    base_currency_amount: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True, index=True)
    valued_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    location_id: Mapped[UUID | None] = mapped_column(DB_UUID, ForeignKey(Location.id), nullable=True, index=True)
    income_period: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    status: Mapped[EntityStatusType] = mapped_column(
        Enum(
            EntityStatusType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]
        ),
        nullable=False,
        server_default=EntityStatusType.ACTIVE.value,
        index=True,
    )
    comment: Mapped[str | None] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    location: Mapped[Location | None] = relationship(Location, lazy="selectin")
    postings: Mapped[list[Posting]] = relationship(
        Posting, lazy="selectin", order_by=[Posting.amount == 0, Posting.amount]
    )

    def __repr__(self):
        return f"<{self.transaction_type} transaction (id={self.id}, base_currency_amount={self.base_currency_amount})>"


TRANSACTION_VALUATION_FUNCTION: str = """
CREATE FUNCTION check_transaction_valuation() RETURNS trigger AS $$
DECLARE
    checked_transaction_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'transactions' THEN
        checked_transaction_id := NEW.id;
    ELSE
        checked_transaction_id := NEW.transaction_id;
    END IF;
    IF EXISTS (
        SELECT 1
        FROM transactions JOIN postings ON postings.transaction_id = transactions.id
        WHERE transactions.id = checked_transaction_id
          AND (transactions.base_currency_amount IS NULL) <> (postings.base_amount IS NULL)
    ) THEN
        RAISE EXCEPTION 'Transaction %% is partly valued', checked_transaction_id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql
"""
TRANSACTION_VALUATION_TRIGGER: str = """
CREATE CONSTRAINT TRIGGER transaction_valuation AFTER INSERT OR UPDATE ON {table}
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_transaction_valuation()
"""

event.listen(Transaction.__table__, "after_create", DDL(TRANSACTION_VALUATION_FUNCTION))
event.listen(Transaction.__table__, "after_create", DDL(TRANSACTION_VALUATION_TRIGGER.format(table="transactions")))
event.listen(Posting.__table__, "after_create", DDL(TRANSACTION_VALUATION_TRIGGER.format(table="postings")))
