"""optional_category_type

Revision ID: 3c68d022c920
Revises: 878bcc08a8a3
Create Date: 2026-11-28 00:39:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3c68d022c920"
down_revision: Union[str, None] = "878bcc08a8a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("account_category_type_by_kind", "accounts", type_="check")


def downgrade() -> None:
    op.execute("UPDATE accounts SET category_type = 'VARIABLE' WHERE kind = 'EXPENSE' AND category_type IS NULL")
    op.create_check_constraint(
        "account_category_type_by_kind", "accounts", "(category_type IS NOT NULL) = (kind = 'EXPENSE')"
    )
