"""transaction entry order

Revision ID: 9a4d2b7e6c15
Revises: 5c2e8f1a9d37
Create Date: 2026-11-10 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a4d2b7e6c15"
down_revision: Union[str, None] = "5c2e8f1a9d37"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.schema.CreateSequence(sa.Sequence("transactions_entry_order_seq")))
    op.add_column("transactions", sa.Column("entry_order", sa.BigInteger(), nullable=True))
    op.execute(
        "UPDATE transactions SET entry_order = numbered.entry_order "
        "FROM (SELECT id, row_number() OVER (ORDER BY id) AS entry_order FROM transactions) AS numbered "
        "WHERE transactions.id = numbered.id"
    )
    op.execute("SET CONSTRAINTS ALL IMMEDIATE")
    op.execute(
        "SELECT setval('transactions_entry_order_seq', "
        "(SELECT COALESCE(max(entry_order), 0) + 1 FROM transactions), false)"
    )
    op.alter_column(
        "transactions",
        "entry_order",
        nullable=False,
        server_default=sa.text("nextval('transactions_entry_order_seq'::regclass)"),
    )


def downgrade() -> None:
    op.drop_column("transactions", "entry_order")
    op.execute(sa.schema.DropSequence(sa.Sequence("transactions_entry_order_seq")))
