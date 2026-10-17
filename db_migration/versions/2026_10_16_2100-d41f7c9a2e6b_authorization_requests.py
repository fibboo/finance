"""authorization requests

Revision ID: d41f7c9a2e6b
Revises: b5d2e8f41a93
Create Date: 2026-10-16 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd41f7c9a2e6b'
down_revision: Union[str, None] = 'b5d2e8f41a93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('authorization_requests',
    sa.Column('id', sa.UUID(), server_default=sa.text('uuidv7()'), nullable=False),
    sa.Column('provider', sa.String(length=24), nullable=False),
    sa.Column('state', sa.String(), nullable=False),
    sa.Column('nonce', sa.String(), nullable=False),
    sa.Column('provider_code_verifier', sa.String(), nullable=False),
    sa.Column('client_redirect_uri', sa.String(), nullable=False),
    sa.Column('client_state', sa.String(), nullable=False),
    sa.Column('client_code_challenge', sa.String(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('code_hash', sa.String(length=64), nullable=True),
    sa.Column('used', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code_hash'),
    sa.UniqueConstraint('state')
    )
    op.create_index(op.f('ix_authorization_requests_user_id'), 'authorization_requests', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_authorization_requests_user_id'), table_name='authorization_requests')
    op.drop_table('authorization_requests')
