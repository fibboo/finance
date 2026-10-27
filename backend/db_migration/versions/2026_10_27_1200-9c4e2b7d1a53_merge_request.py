"""merge request

Revision ID: 9c4e2b7d1a53
Revises: 723630af39a4
Create Date: 2026-10-27 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c4e2b7d1a53"
down_revision: Union[str, None] = "723630af39a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("authorization_requests", sa.Column("merge_user_id", sa.UUID(), nullable=True))
    op.add_column("authorization_requests", sa.Column("merge_code_hash", sa.String(length=64), nullable=True))
    op.add_column("authorization_requests", sa.Column("merge_expires_at", sa.DateTime(), nullable=True))
    op.create_index(
        op.f("ix_authorization_requests_merge_user_id"), "authorization_requests", ["merge_user_id"], unique=False
    )
    op.create_unique_constraint(
        op.f("authorization_requests_merge_code_hash_key"), "authorization_requests", ["merge_code_hash"]
    )
    op.create_foreign_key(
        op.f("authorization_requests_merge_user_id_fkey"), "authorization_requests", "users", ["merge_user_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint(op.f("authorization_requests_merge_user_id_fkey"), "authorization_requests", type_="foreignkey")
    op.drop_constraint(op.f("authorization_requests_merge_code_hash_key"), "authorization_requests", type_="unique")
    op.drop_index(op.f("ix_authorization_requests_merge_user_id"), table_name="authorization_requests")
    op.drop_column("authorization_requests", "merge_expires_at")
    op.drop_column("authorization_requests", "merge_code_hash")
    op.drop_column("authorization_requests", "merge_user_id")
