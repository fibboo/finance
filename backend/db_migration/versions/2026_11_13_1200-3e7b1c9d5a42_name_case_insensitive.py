"""name case insensitive

Revision ID: 3e7b1c9d5a42
Revises: 9a4d2b7e6c15
Create Date: 2026-11-13 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3e7b1c9d5a42"
down_revision: Union[str, None] = "9a4d2b7e6c15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NAME_MAX_LENGTH = 32


def _rename_duplicates(*, table: str, scope_columns: list[str]) -> None:
    connection = op.get_bind()
    scope = ", ".join(scope_columns)
    rows = connection.execute(
        sa.text(f"SELECT id, {scope}, name FROM {table} WHERE status = 'ACTIVE' ORDER BY created_at, id")
    ).all()
    taken_names: set[tuple] = set()
    for row in rows:
        taken_names.add((*row[1:-1], row.name.lower()))

    kept_names: set[tuple] = set()
    for row in rows:
        key = (*row[1:-1], row.name.lower())
        if key not in kept_names:
            kept_names.add(key)
            continue

        number = 2
        new_name = row.name
        while (*row[1:-1], new_name.lower()) in taken_names:
            suffix = f" {number}"
            new_name = f"{row.name[: NAME_MAX_LENGTH - len(suffix)]}{suffix}"
            number += 1

        taken_names.add((*row[1:-1], new_name.lower()))
        kept_names.add((*row[1:-1], new_name.lower()))
        connection.execute(sa.text(f"UPDATE {table} SET name = :name WHERE id = :id"), {"name": new_name, "id": row.id})


def upgrade() -> None:
    _rename_duplicates(table="accounts", scope_columns=["user_id", "kind"])
    _rename_duplicates(table="locations", scope_columns=["user_id"])
    op.drop_index(
        "account_unique_user_id_kind_name", table_name="accounts", postgresql_where=sa.text("status = 'ACTIVE'")
    )
    op.create_index(
        "account_unique_user_id_kind_name",
        "accounts",
        ["user_id", "kind", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.drop_index("location_unique_user_id_name", table_name="locations", postgresql_where=sa.text("status = 'ACTIVE'"))
    op.create_index(
        "location_unique_user_id_name",
        "locations",
        ["user_id", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )


def downgrade() -> None:
    op.drop_index("location_unique_user_id_name", table_name="locations", postgresql_where=sa.text("status = 'ACTIVE'"))
    op.create_index(
        "location_unique_user_id_name",
        "locations",
        ["user_id", "name"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.drop_index(
        "account_unique_user_id_kind_name", table_name="accounts", postgresql_where=sa.text("status = 'ACTIVE'")
    )
    op.create_index(
        "account_unique_user_id_kind_name",
        "accounts",
        ["user_id", "kind", "name"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
