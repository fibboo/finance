"""account description 256

Revision ID: 5c2e8f1a9d37
Revises: b7e3c91a4d28
Create Date: 2026-11-10 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5c2e8f1a9d37"
down_revision: Union[str, None] = "b7e3c91a4d28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DESCRIPTION_LENGTH = 256
OLD_DESCRIPTION_LENGTH = 4096


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE accounts SET description = rtrim(left(description, :length)) WHERE length(description) > :length"
        ).bindparams(length=DESCRIPTION_LENGTH)
    )
    op.alter_column(
        "accounts",
        "description",
        type_=sa.String(DESCRIPTION_LENGTH),
        existing_type=sa.String(OLD_DESCRIPTION_LENGTH),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "accounts",
        "description",
        type_=sa.String(OLD_DESCRIPTION_LENGTH),
        existing_type=sa.String(DESCRIPTION_LENGTH),
        existing_nullable=True,
    )
