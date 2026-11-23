import sqlalchemy as sa
from alembic import op

revision: str = "9d678ac4c332"
down_revision: str = "3e7b1c9d5a42"
branch_labels: None = None
depends_on: None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("category_purpose", sa.Enum("PERSONAL", "INCOME_COST", native_enum=False), nullable=True),
    )
    op.execute("UPDATE accounts SET category_purpose = 'PERSONAL' WHERE kind = 'EXPENSE'")
    op.create_check_constraint(
        "account_category_purpose_by_kind", "accounts", "category_purpose IS NULL OR kind = 'EXPENSE'"
    )


def downgrade() -> None:
    op.drop_constraint("account_category_purpose_by_kind", "accounts", type_="check")
    op.drop_column("accounts", "category_purpose")
