"""username ci

Revision ID: a7c3e9d1f2b4
Revises: 7c3e9a1d2b4f
Create Date: 2026-10-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e9d1f2b4'
down_revision: Union[str, None] = '7c3e9a1d2b4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.create_index('uq_users_username_lower', 'users', [sa.literal_column('lower(username)')], unique=True)


def downgrade() -> None:
    op.drop_index('uq_users_username_lower', table_name='users')
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
