from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    func,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.accounting.classification import Classification
from app.models.accounting.currency import Currency
from app.models.base import Base
from app.schemas.accounting.account import AccountKind, CategoryPurpose, CategoryType
from app.schemas.base import EntityStatusType

ACCOUNT_UNIQUE_NAME_INDEX = "account_unique_user_id_kind_name"
MONEY_ACCOUNT_UNIQUE_NAME_INDEX = "account_unique_user_id_classification_id_name"


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "classification_id"],
            [Classification.user_id, Classification.id],
            name="account_classification_owner_fk",
        ),
        CheckConstraint(
            f"classification_id IS NULL OR kind IN ('{AccountKind.ASSET.value}', '{AccountKind.EXPENSE.value}')",
            name="account_classification_by_kind",
        ),
        CheckConstraint(
            f"category_purpose IS NULL OR kind = '{AccountKind.EXPENSE.value}'",
            name="account_category_purpose_by_kind",
        ),
        CheckConstraint(
            f"(currency IS NOT NULL) = (kind = '{AccountKind.ASSET.value}')",
            name="account_currency_by_kind",
        ),
        CheckConstraint(
            f"(category_type IS NOT NULL) = (kind = '{AccountKind.EXPENSE.value}')",
            name="account_category_type_by_kind",
        ),
        CheckConstraint(
            f"color IS NULL OR kind = '{AccountKind.ASSET.value}'",
            name="account_color_by_kind",
        ),
    )

    id: Mapped[UUID] = mapped_column(  # noqa: A003
        DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True)
    )
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)
    kind: Mapped[AccountKind] = mapped_column(
        Enum(AccountKind, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(256), nullable=True)

    balance: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="0")
    currency: Mapped[str | None] = mapped_column(String(3), ForeignKey(Currency.code), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    category_type: Mapped[CategoryType | None] = mapped_column(
        Enum(CategoryType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=True,
    )
    classification_id: Mapped[UUID | None] = mapped_column(DB_UUID, index=True)
    category_purpose: Mapped[CategoryPurpose | None] = mapped_column(
        Enum(CategoryPurpose, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]),
        nullable=True,
    )
    base_balance: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="0")
    status: Mapped[EntityStatusType] = mapped_column(
        Enum(
            EntityStatusType, native_enum=False, validate_strings=True, values_callable=lambda x: [i.value for i in x]
        ),
        nullable=False,
        server_default=EntityStatusType.ACTIVE.value,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self):
        return f"<Account (id={self.id}, name={self.name}, balance={self.balance})>"


Index(
    ACCOUNT_UNIQUE_NAME_INDEX,
    Account.user_id,
    Account.kind,
    func.lower(Account.name),
    unique=True,
    postgresql_where=text(f"status = '{EntityStatusType.ACTIVE.value}' AND kind <> '{AccountKind.ASSET.value}'"),
)

Index(
    MONEY_ACCOUNT_UNIQUE_NAME_INDEX,
    Account.user_id,
    Account.classification_id,
    func.lower(Account.name),
    unique=True,
    postgresql_nulls_not_distinct=True,
    postgresql_where=text(f"status = '{EntityStatusType.ACTIVE.value}' AND kind = '{AccountKind.ASSET.value}'"),
)
