"""nullable currency

Revision ID: b5d2e8f41a93
Revises: 7f3e9a1c4b2d
Create Date: 2026-10-16 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5d2e8f41a93'
down_revision: Union[str, None] = '7f3e9a1c4b2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'base_currency',
               existing_type=sa.String(length=24),
               nullable=True,
               server_default=None)


def downgrade() -> None:
    op.execute("UPDATE users SET base_currency = 'USD' WHERE base_currency IS NULL")
    op.alter_column('users', 'base_currency',
               existing_type=sa.String(length=24),
               nullable=False,
               server_default='USD')
