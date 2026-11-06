"""money account color

Revision ID: 838014b55f6b
Revises: 9c4e2b7d1a53
Create Date: 2026-11-06 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "838014b55f6b"
down_revision: Union[str, None] = "9c4e2b7d1a53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE accounts SET color = NULL WHERE kind NOT IN ('ASSET', 'LIABILITY')")
    op.create_check_constraint("account_color_by_kind", "accounts", "color IS NULL OR kind IN ('ASSET', 'LIABILITY')")


def downgrade() -> None:
    op.drop_constraint("account_color_by_kind", "accounts", type_="check")
