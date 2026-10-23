"""location status

Revision ID: 131188dc78c9
Revises: 1ea5f6f81b05
Create Date: 2026-10-23 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "131188dc78c9"
down_revision: Union[str, None] = "1ea5f6f81b05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "locations",
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "DELETED", name="entitystatustype", native_enum=False),
            server_default="ACTIVE",
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_locations_status"), "locations", ["status"], unique=False)
    op.drop_constraint("location_unique_user_id_name", "locations", type_="unique")
    op.create_index(
        "location_unique_user_id_name",
        "locations",
        ["user_id", "name"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.drop_constraint("locations_coordinates_key", "locations", type_="unique")
    op.drop_column("locations", "coordinates")


def downgrade() -> None:
    op.add_column("locations", sa.Column("coordinates", sa.String(length=64), nullable=True))
    op.create_unique_constraint("locations_coordinates_key", "locations", ["coordinates"])
    op.execute("UPDATE locations SET name = left(name, 27) || '-' || id::text WHERE status = 'DELETED'")
    op.drop_index("location_unique_user_id_name", table_name="locations", postgresql_where=sa.text("status = 'ACTIVE'"))
    op.create_unique_constraint("location_unique_user_id_name", "locations", ["user_id", "name"])
    op.drop_index(op.f("ix_locations_status"), table_name="locations")
    op.drop_column("locations", "status")
