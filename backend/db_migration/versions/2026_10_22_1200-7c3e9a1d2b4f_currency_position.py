"""currency position

Revision ID: 7c3e9a1d2b4f
Revises: 05fc98bcbb83
Create Date: 2026-10-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c3e9a1d2b4f'
down_revision: Union[str, None] = '05fc98bcbb83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('currencies', sa.Column('position', sa.Integer(), nullable=True))
    op.execute(
        "UPDATE currencies SET position = CASE code "
        "WHEN 'USD' THEN 1 "
        "WHEN 'EUR' THEN 2 "
        "WHEN 'RSD' THEN 3 "
        "WHEN 'GEL' THEN 4 "
        "WHEN 'TRY' THEN 5 "
        "WHEN 'RUB' THEN 6 "
        "END"
    )
    op.alter_column('currencies', 'position', nullable=False)
    op.create_unique_constraint('currencies_position_key', 'currencies', ['position'])


def downgrade() -> None:
    op.drop_constraint('currencies_position_key', 'currencies', type_='unique')
    op.drop_column('currencies', 'position')
