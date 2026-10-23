"""ledger accounts

Revision ID: 3561e4292c5d
Revises: 05fc98bcbb83
Create Date: 2026-10-22 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3561e4292c5d"
down_revision: Union[str, None] = "05fc98bcbb83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _delete_accounting_rows() -> None:
    op.execute("DELETE FROM transactions_expense")
    op.execute("DELETE FROM transactions_income")
    op.execute("DELETE FROM transactions_transfer")
    op.execute("DELETE FROM transactions_adjustment")
    op.execute("DELETE FROM transactions")
    op.execute("DELETE FROM accounts")


def upgrade() -> None:
    _delete_accounting_rows()
    op.execute("UPDATE users SET base_currency = NULL")

    op.drop_constraint("transactions_expense_category_id_fkey", "transactions_expense", type_="foreignkey")
    op.drop_constraint("transactions_income_income_source_id_fkey", "transactions_income", type_="foreignkey")
    op.create_foreign_key(None, "transactions_expense", "accounts", ["category_id"], ["id"])
    op.create_foreign_key(None, "transactions_income", "accounts", ["income_source_id"], ["id"])

    op.drop_index(
        "category_unique_user_id_name", table_name="categories", postgresql_where=sa.text("status = 'ACTIVE'")
    )
    op.drop_index(op.f("ix_categories_name"), table_name="categories")
    op.drop_index(op.f("ix_categories_status"), table_name="categories")
    op.drop_index(op.f("ix_categories_type"), table_name="categories")
    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_table("categories")
    op.drop_index(op.f("ix_income_sources_name"), table_name="income_sources")
    op.drop_index(op.f("ix_income_sources_user_id"), table_name="income_sources")
    op.drop_table("income_sources")

    op.add_column(
        "accounts",
        sa.Column(
            "kind",
            sa.Enum("ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", name="accountkind", native_enum=False),
            nullable=False,
        ),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "category_type",
            sa.Enum("VARIABLE", "FIXED", "PERIODIC", name="categorytype", native_enum=False),
            nullable=True,
        ),
    )
    op.alter_column("accounts", "currency", existing_type=sa.String(length=3), nullable=True)
    op.drop_index("account_unique_user_id_name", table_name="accounts", postgresql_where=sa.text("status = 'ACTIVE'"))
    op.create_index(
        "account_unique_user_id_kind_name",
        "accounts",
        ["user_id", "kind", "name"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.create_index(op.f("ix_accounts_kind"), "accounts", ["kind"], unique=False)
    op.create_check_constraint(
        "account_currency_by_kind", "accounts", "(currency IS NOT NULL) = (kind IN ('ASSET', 'LIABILITY'))"
    )
    op.create_check_constraint(
        "account_category_type_by_kind", "accounts", "(category_type IS NOT NULL) = (kind = 'EXPENSE')"
    )


def downgrade() -> None:
    _delete_accounting_rows()
    op.execute("UPDATE users SET base_currency = NULL")

    op.drop_constraint("account_category_type_by_kind", "accounts", type_="check")
    op.drop_constraint("account_currency_by_kind", "accounts", type_="check")
    op.drop_index(op.f("ix_accounts_kind"), table_name="accounts")
    op.drop_index(
        "account_unique_user_id_kind_name", table_name="accounts", postgresql_where=sa.text("status = 'ACTIVE'")
    )
    op.create_index(
        "account_unique_user_id_name",
        "accounts",
        ["user_id", "name"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.alter_column("accounts", "currency", existing_type=sa.String(length=3), nullable=False)
    op.drop_column("accounts", "category_type")
    op.drop_column("accounts", "kind")

    op.create_table(
        "income_sources",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=4096), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="income_source_unique_user_id_name"),
    )
    op.create_index(op.f("ix_income_sources_name"), "income_sources", ["name"], unique=False)
    op.create_index(op.f("ix_income_sources_user_id"), "income_sources", ["user_id"], unique=False)
    op.create_table(
        "categories",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=4096), nullable=True),
        sa.Column(
            "type", sa.Enum("VARIABLE", "FIXED", "PERIODIC", name="categorytype", native_enum=False), nullable=False
        ),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "DELETED", name="entitystatustype", native_enum=False),
            server_default="ACTIVE",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "category_unique_user_id_name",
        "categories",
        ["user_id", "name"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.create_index(op.f("ix_categories_name"), "categories", ["name"], unique=False)
    op.create_index(op.f("ix_categories_status"), "categories", ["status"], unique=False)
    op.create_index(op.f("ix_categories_type"), "categories", ["type"], unique=False)
    op.create_index(op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False)

    op.drop_constraint("transactions_income_income_source_id_fkey", "transactions_income", type_="foreignkey")
    op.drop_constraint("transactions_expense_category_id_fkey", "transactions_expense", type_="foreignkey")
    op.create_foreign_key(None, "transactions_income", "income_sources", ["income_source_id"], ["id"])
    op.create_foreign_key(None, "transactions_expense", "categories", ["category_id"], ["id"])
