"""link user id

Revision ID: e8a3c5f17b42
Revises: d41f7c9a2e6b
Create Date: 2026-10-17 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e8a3c5f17b42'
down_revision: Union[str, None] = 'd41f7c9a2e6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('authorization_requests', sa.Column('link_user_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'authorization_requests', 'users', ['link_user_id'], ['id'])
    op.add_column('authorization_requests', sa.Column('link_identity', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_unique_constraint('uq_external_users_provider_external_id', 'external_users', ['provider', 'external_id'])
    op.create_unique_constraint('uq_external_users_user_id_provider', 'external_users', ['user_id', 'provider'])


def downgrade() -> None:
    op.drop_constraint('uq_external_users_user_id_provider', 'external_users', type_='unique')
    op.drop_constraint('uq_external_users_provider_external_id', 'external_users', type_='unique')
    op.drop_column('authorization_requests', 'link_identity')
    op.drop_constraint('authorization_requests_link_user_id_fkey', 'authorization_requests', type_='foreignkey')
    op.drop_column('authorization_requests', 'link_user_id')
