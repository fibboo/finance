from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, func, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.accounting.account import Account
from app.models.accounting.currency import Currency
from app.models.base import Base


class Posting(Base):
    __tablename__ = "postings"

    id: Mapped[UUID] = mapped_column(  # noqa: A003
        DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True)
    )
    transaction_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey("transactions.id"), nullable=False, index=True)
    account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=False, index=True)

    amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), ForeignKey(Currency.code), nullable=False)
    base_amount: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    account: Mapped[Account] = relationship(Account, lazy="selectin")

    def __repr__(self):
        return f"<Posting (id={self.id}, account_id={self.account_id}, amount={self.amount})>"
