"""name length 32

Revision ID: b7e3c91a4d28
Revises: 4f1d8a6c2b90
Create Date: 2026-11-09 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e3c91a4d28"
down_revision: Union[str, None] = "4f1d8a6c2b90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NAME_LENGTH = 32
OLD_NAME_LENGTH = 16


def _build_free_name(*, name: str, taken_names: set[str]) -> str:
    number: int = 1
    free_name: str = name[:OLD_NAME_LENGTH].rstrip()
    while free_name in taken_names:
        number += 1
        suffix: str = f" {number}"
        free_name = f"{name[: OLD_NAME_LENGTH - len(suffix)].rstrip()}{suffix}"

    return free_name


def _cut_names(*, table: str, group_columns: list[str]) -> None:
    connection: sa.Connection = op.get_bind()
    group: str = ", ".join(group_columns)
    rows: list[sa.Row] = connection.execute(
        sa.text(f"SELECT id, name, status, {group} FROM {table} ORDER BY id")
    ).fetchall()

    active_rows: list[sa.Row] = [row for row in rows if row.status == "ACTIVE"]
    deleted_rows: list[sa.Row] = [row for row in rows if row.status != "ACTIVE"]
    taken_names: dict[tuple, set[str]] = {}
    for status_rows in (active_rows, deleted_rows):
        for row in status_rows:
            if len(row.name) <= OLD_NAME_LENGTH:
                taken_names.setdefault(tuple(getattr(row, column) for column in group_columns), set()).add(row.name)

        for row in status_rows:
            if len(row.name) <= OLD_NAME_LENGTH:
                continue

            group_names: set[str] = taken_names.setdefault(
                tuple(getattr(row, column) for column in group_columns), set()
            )
            free_name: str = _build_free_name(name=row.name, taken_names=group_names)
            group_names.add(free_name)
            connection.execute(
                sa.text(f"UPDATE {table} SET name = :name WHERE id = :id"), {"name": free_name, "id": row.id}
            )


def upgrade() -> None:
    op.alter_column("accounts", "name", type_=sa.String(NAME_LENGTH), existing_type=sa.String(OLD_NAME_LENGTH))
    op.alter_column("locations", "name", type_=sa.String(NAME_LENGTH), existing_type=sa.String(OLD_NAME_LENGTH))


def downgrade() -> None:
    _cut_names(table="locations", group_columns=["user_id"])
    _cut_names(table="accounts", group_columns=["user_id", "kind"])
    op.alter_column("locations", "name", type_=sa.String(OLD_NAME_LENGTH), existing_type=sa.String(NAME_LENGTH))
    op.alter_column("accounts", "name", type_=sa.String(OLD_NAME_LENGTH), existing_type=sa.String(NAME_LENGTH))
