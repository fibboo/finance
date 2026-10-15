"""uuidv7 primary keys

Revision ID: 2c53ac50bb04
Revises: a206d16c2432
Create Date: 2026-10-15 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c53ac50bb04'
down_revision: Union[str, None] = 'a206d16c2432'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('accounts', 'id', server_default=sa.text('uuidv7()'))
    op.alter_column('categories', 'id', server_default=sa.text('uuidv7()'))
    op.alter_column('income_sources', 'id', server_default=sa.text('uuidv7()'))
    op.alter_column('locations', 'id', server_default=sa.text('uuidv7()'))
    op.alter_column('transactions', 'id', server_default=sa.text('uuidv7()'))
    op.alter_column('users', 'id', server_default=sa.text('uuidv7()'))
    op.alter_column('external_users', 'id', server_default=sa.text('uuidv7()'))


def downgrade() -> None:
    op.alter_column('external_users', 'id', server_default=sa.text('gen_random_uuid()'))
    op.alter_column('users', 'id', server_default=sa.text('gen_random_uuid()'))
    op.alter_column('transactions', 'id', server_default=sa.text('gen_random_uuid()'))
    op.alter_column('locations', 'id', server_default=sa.text('gen_random_uuid()'))
    op.alter_column('income_sources', 'id', server_default=sa.text('gen_random_uuid()'))
    op.alter_column('categories', 'id', server_default=sa.text('gen_random_uuid()'))
    op.alter_column('accounts', 'id', server_default=sa.text('gen_random_uuid()'))
