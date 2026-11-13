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

NAME_LENGTH = 32


def _build_numbered_name(*, name: str, number: int) -> str:
    suffix: str = f" {number}"
    numbered_name: str = f"{name[: NAME_LENGTH - len(suffix)].rstrip()}{suffix}"
    return numbered_name


def _rename_case_duplicates(*, table: str, scope_columns: list[str]) -> None:
    connection: sa.Connection = op.get_bind()
    scope: str = ", ".join(scope_columns)
    same_scope: str = " AND ".join(f"{column} = :{column}" for column in scope_columns)
    duplicates: list[sa.Row] = connection.execute(
        sa.text(
            f"SELECT id, name, {scope} FROM ("
            f"SELECT id, name, created_at, {scope}, "
            f"row_number() OVER (PARTITION BY {scope}, lower(name) ORDER BY created_at, id) AS position "
            f"FROM {table} WHERE status = 'ACTIVE') AS ranked "
            "WHERE position > 1 ORDER BY created_at, id"
        )
    ).fetchall()
    for duplicate in duplicates:
        scope_values: dict[str, object] = {column: getattr(duplicate, column) for column in scope_columns}
        number: int = 1
        new_name: str = duplicate.name
        is_name_taken: bool = True
        while is_name_taken:
            number += 1
            new_name = _build_numbered_name(name=duplicate.name, number=number)
            is_name_taken = connection.execute(
                sa.text(
                    f"SELECT EXISTS (SELECT 1 FROM {table} "
                    f"WHERE status = 'ACTIVE' AND {same_scope} AND lower(name) = lower(:name))"
                ),
                {**scope_values, "name": new_name},
            ).scalar_one()

        connection.execute(
            sa.text(f"UPDATE {table} SET name = :name WHERE id = :id"), {"name": new_name, "id": duplicate.id}
        )


def upgrade() -> None:
    _rename_case_duplicates(table="accounts", scope_columns=["user_id", "kind"])
    _rename_case_duplicates(table="locations", scope_columns=["user_id"])
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
