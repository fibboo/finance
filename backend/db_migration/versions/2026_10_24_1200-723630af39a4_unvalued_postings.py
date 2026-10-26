"""unvalued postings

Revision ID: 723630af39a4
Revises: 131188dc78c9
Create Date: 2026-10-24 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "723630af39a4"
down_revision: Union[str, None] = "131188dc78c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("postings", "base_amount", existing_type=sa.Numeric(), nullable=True)
    op.alter_column("transactions", "base_currency_amount", existing_type=sa.Numeric(), nullable=True)
    op.add_column("transactions", sa.Column("valued_on", sa.Date(), nullable=True))
    op.execute("""
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
                RAISE EXCEPTION 'Transaction % is partly valued', checked_transaction_id USING ERRCODE = 'check_violation';
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql
        """)
    for table in ("transactions", "postings"):
        op.execute(f"""
            CREATE CONSTRAINT TRIGGER transaction_valuation AFTER INSERT OR UPDATE ON {table}
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_transaction_valuation()
            """)


def downgrade() -> None:
    op.execute("DROP TRIGGER transaction_valuation ON postings")
    op.execute("DROP TRIGGER transaction_valuation ON transactions")
    op.execute("DROP FUNCTION check_transaction_valuation()")
    op.execute("""
        UPDATE accounts SET base_balance = accounts.base_balance - exchange.base_amount
        FROM (
            SELECT postings.account_id, sum(postings.base_amount) AS base_amount
            FROM postings JOIN transactions ON transactions.id = postings.transaction_id
            WHERE postings.amount = 0 AND transactions.status = 'ACTIVE'
            GROUP BY postings.account_id
        ) AS exchange
        WHERE accounts.id = exchange.account_id
        """)
    op.execute("DELETE FROM postings WHERE amount = 0")
    op.execute("""
        UPDATE accounts SET balance = accounts.balance - unvalued.amount
        FROM (
            SELECT postings.account_id, sum(postings.amount) AS amount
            FROM postings JOIN transactions ON transactions.id = postings.transaction_id
            WHERE transactions.base_currency_amount IS NULL AND transactions.status = 'ACTIVE'
            GROUP BY postings.account_id
        ) AS unvalued
        WHERE accounts.id = unvalued.account_id AND accounts.kind IN ('ASSET', 'LIABILITY')
        """)
    op.execute("""
        DELETE FROM postings USING transactions
        WHERE transactions.id = postings.transaction_id AND transactions.base_currency_amount IS NULL
        """)
    op.execute("""
        DELETE FROM transactions
        WHERE base_currency_amount IS NULL
           OR NOT EXISTS (SELECT 1 FROM postings WHERE postings.transaction_id = transactions.id)
        """)
    op.drop_column("transactions", "valued_on")
    op.alter_column("transactions", "base_currency_amount", existing_type=sa.Numeric(), nullable=False)
    op.alter_column("postings", "base_amount", existing_type=sa.Numeric(), nullable=False)
