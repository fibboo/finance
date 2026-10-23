"""ledger postings

Revision ID: 1ea5f6f81b05
Revises: 3561e4292c5d
Create Date: 2026-10-23 12:56:32.454560

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1ea5f6f81b05"
down_revision: Union[str, None] = "3561e4292c5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM transactions_expense")
    op.execute("DELETE FROM transactions_income")
    op.execute("DELETE FROM transactions_transfer")
    op.execute("DELETE FROM transactions_adjustment")
    op.execute("DELETE FROM transactions")
    op.execute("UPDATE accounts SET balance = 0")

    op.create_table(
        "postings",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("base_amount", sa.Numeric(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["currency"],
            ["currencies.code"],
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_postings_account_id"), "postings", ["account_id"], unique=False)
    op.create_index(op.f("ix_postings_transaction_id"), "postings", ["transaction_id"], unique=False)
    op.drop_index(op.f("ix_transactions_transfer_from_account_id"), table_name="transactions_transfer")
    op.drop_index(op.f("ix_transactions_transfer_to_account_id"), table_name="transactions_transfer")
    op.drop_table("transactions_transfer")
    op.drop_index(op.f("ix_transactions_adjustment_from_account_id"), table_name="transactions_adjustment")
    op.drop_index(op.f("ix_transactions_adjustment_to_account_id"), table_name="transactions_adjustment")
    op.drop_table("transactions_adjustment")
    op.drop_index(op.f("ix_transactions_income_income_period"), table_name="transactions_income")
    op.drop_index(op.f("ix_transactions_income_income_source_id"), table_name="transactions_income")
    op.drop_index(op.f("ix_transactions_income_to_account_id"), table_name="transactions_income")
    op.drop_table("transactions_income")
    op.drop_index(op.f("ix_transactions_expense_category_id"), table_name="transactions_expense")
    op.drop_index(op.f("ix_transactions_expense_from_account_id"), table_name="transactions_expense")
    op.drop_index(op.f("ix_transactions_expense_location_id"), table_name="transactions_expense")
    op.drop_table("transactions_expense")
    op.add_column("accounts", sa.Column("base_balance", sa.Numeric(), server_default="0", nullable=False))
    op.drop_column("accounts", "base_currency_rate")
    op.add_column("transactions", sa.Column("location_id", sa.UUID(), nullable=True))
    op.add_column("transactions", sa.Column("income_period", sa.Date(), nullable=True))
    op.drop_index(op.f("ix_transactions_source_amount"), table_name="transactions")
    op.create_index(op.f("ix_transactions_income_period"), "transactions", ["income_period"], unique=False)
    op.create_index(op.f("ix_transactions_location_id"), "transactions", ["location_id"], unique=False)
    op.drop_constraint(op.f("transactions_source_currency_fkey"), "transactions", type_="foreignkey")
    op.drop_constraint(op.f("transactions_destination_currency_fkey"), "transactions", type_="foreignkey")
    op.create_foreign_key("transactions_location_id_fkey", "transactions", "locations", ["location_id"], ["id"])
    op.drop_column("transactions", "destination_amount")
    op.drop_column("transactions", "source_currency")
    op.drop_column("transactions", "source_amount")
    op.drop_column("transactions", "destination_currency")
    op.create_check_constraint(
        "transaction_location_by_type", "transactions", "(location_id IS NOT NULL) = (transaction_type = 'EXPENSE')"
    )
    op.create_check_constraint(
        "transaction_income_period_by_type",
        "transactions",
        "(income_period IS NOT NULL) = (transaction_type = 'INCOME')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM postings")
    op.execute("DELETE FROM transactions")
    op.execute("UPDATE accounts SET balance = 0")

    op.drop_constraint("transaction_income_period_by_type", "transactions", type_="check")
    op.drop_constraint("transaction_location_by_type", "transactions", type_="check")
    op.add_column(
        "transactions", sa.Column("destination_currency", sa.VARCHAR(length=3), autoincrement=False, nullable=False)
    )
    op.add_column("transactions", sa.Column("source_amount", sa.NUMERIC(), autoincrement=False, nullable=False))
    op.add_column(
        "transactions", sa.Column("source_currency", sa.VARCHAR(length=3), autoincrement=False, nullable=False)
    )
    op.add_column("transactions", sa.Column("destination_amount", sa.NUMERIC(), autoincrement=False, nullable=False))
    op.drop_constraint("transactions_location_id_fkey", "transactions", type_="foreignkey")
    op.create_foreign_key(
        op.f("transactions_destination_currency_fkey"), "transactions", "currencies", ["destination_currency"], ["code"]
    )
    op.create_foreign_key(
        op.f("transactions_source_currency_fkey"), "transactions", "currencies", ["source_currency"], ["code"]
    )
    op.drop_index(op.f("ix_transactions_location_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_income_period"), table_name="transactions")
    op.create_index(op.f("ix_transactions_source_amount"), "transactions", ["source_amount"], unique=False)
    op.drop_column("transactions", "income_period")
    op.drop_column("transactions", "location_id")
    op.add_column(
        "accounts",
        sa.Column(
            "base_currency_rate",
            sa.NUMERIC(),
            server_default=sa.text("'0'::numeric"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.drop_column("accounts", "base_balance")
    op.execute(
        "UPDATE accounts SET base_currency_rate = 1 "
        "FROM users "
        "WHERE users.id = accounts.user_id "
        "AND accounts.currency = users.base_currency"
    )
    op.create_table(
        "transactions_expense",
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("from_account_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("category_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("location_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["accounts.id"], name=op.f("transactions_expense_category_id_fkey")),
        sa.ForeignKeyConstraint(
            ["from_account_id"], ["accounts.id"], name=op.f("transactions_expense_from_account_id_fkey")
        ),
        sa.ForeignKeyConstraint(["id"], ["transactions.id"], name=op.f("transactions_expense_id_fkey")),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], name=op.f("transactions_expense_location_id_fkey")),
        sa.PrimaryKeyConstraint("id", name=op.f("transactions_expense_pkey")),
    )
    op.create_index(op.f("ix_transactions_expense_location_id"), "transactions_expense", ["location_id"], unique=False)
    op.create_index(
        op.f("ix_transactions_expense_from_account_id"), "transactions_expense", ["from_account_id"], unique=False
    )
    op.create_index(op.f("ix_transactions_expense_category_id"), "transactions_expense", ["category_id"], unique=False)
    op.create_table(
        "transactions_income",
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("income_period", sa.DATE(), autoincrement=False, nullable=False),
        sa.Column("income_source_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("to_account_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(["id"], ["transactions.id"], name=op.f("transactions_income_id_fkey")),
        sa.ForeignKeyConstraint(
            ["income_source_id"], ["accounts.id"], name=op.f("transactions_income_income_source_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["to_account_id"], ["accounts.id"], name=op.f("transactions_income_to_account_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("transactions_income_pkey")),
    )
    op.create_index(
        op.f("ix_transactions_income_to_account_id"), "transactions_income", ["to_account_id"], unique=False
    )
    op.create_index(
        op.f("ix_transactions_income_income_source_id"), "transactions_income", ["income_source_id"], unique=False
    )
    op.create_index(
        op.f("ix_transactions_income_income_period"), "transactions_income", ["income_period"], unique=False
    )
    op.create_table(
        "transactions_adjustment",
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("from_account_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column("to_account_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.CheckConstraint(
            "(from_account_id IS NULL) <> (to_account_id IS NULL)", name=op.f("transaction_adjustment_one_account")
        ),
        sa.ForeignKeyConstraint(
            ["from_account_id"], ["accounts.id"], name=op.f("transactions_adjustment_from_account_id_fkey")
        ),
        sa.ForeignKeyConstraint(["id"], ["transactions.id"], name=op.f("transactions_adjustment_id_fkey")),
        sa.ForeignKeyConstraint(
            ["to_account_id"], ["accounts.id"], name=op.f("transactions_adjustment_to_account_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("transactions_adjustment_pkey")),
    )
    op.create_index(
        op.f("ix_transactions_adjustment_to_account_id"), "transactions_adjustment", ["to_account_id"], unique=False
    )
    op.create_index(
        op.f("ix_transactions_adjustment_from_account_id"), "transactions_adjustment", ["from_account_id"], unique=False
    )
    op.create_table(
        "transactions_transfer",
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("from_account_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("to_account_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["from_account_id"], ["accounts.id"], name=op.f("transactions_transfer_from_account_id_fkey")
        ),
        sa.ForeignKeyConstraint(["id"], ["transactions.id"], name=op.f("transactions_transfer_id_fkey")),
        sa.ForeignKeyConstraint(
            ["to_account_id"], ["accounts.id"], name=op.f("transactions_transfer_to_account_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("transactions_transfer_pkey")),
    )
    op.create_index(
        op.f("ix_transactions_transfer_to_account_id"), "transactions_transfer", ["to_account_id"], unique=False
    )
    op.create_index(
        op.f("ix_transactions_transfer_from_account_id"), "transactions_transfer", ["from_account_id"], unique=False
    )
    op.drop_index(op.f("ix_postings_transaction_id"), table_name="postings")
    op.drop_index(op.f("ix_postings_account_id"), table_name="postings")
    op.drop_table("postings")
