"""base currency rate

Revision ID: 05fc98bcbb83
Revises: 4f1dcaf563be
Create Date: 2026-10-22 01:17:46.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05fc98bcbb83'
down_revision: Union[str, None] = '4f1dcaf563be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE accounts SET base_currency_rate = 1 "
        "FROM users "
        "WHERE users.id = accounts.user_id "
        "AND accounts.currency = users.base_currency "
        "AND accounts.base_currency_rate <> 1"
    )


def downgrade() -> None:
    pass
