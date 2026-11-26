import sqlalchemy as sa
from alembic import op

revision: str = "125bafdcc4dc"
down_revision: str = "6f417f37d6f9"
branch_labels: None = None
depends_on: None = None

ACCOUNT_KINDS = sa.Enum("ASSET", "EQUITY", "INCOME", "EXPENSE", name="accountkind", native_enum=False)
LEGACY_ACCOUNT_KINDS = sa.VARCHAR(length=9)


def upgrade() -> None:
    op.drop_index("account_unique_user_id_kind_name", table_name="accounts")
    op.execute("""
        DO $$
        DECLARE
            account RECORD;
            suffix_number integer;
            free_name text;
        BEGIN
            FOR account IN
                SELECT id, user_id, classification_id, name
                FROM (
                    SELECT id, user_id, classification_id, name,
                           row_number() OVER (
                               PARTITION BY user_id, classification_id, lower(name) ORDER BY kind, id
                           ) AS position
                    FROM accounts
                    WHERE status = 'ACTIVE' AND kind IN ('ASSET', 'LIABILITY')
                ) AS ranked
                WHERE position > 1
            LOOP
                suffix_number := 1;
                LOOP
                    suffix_number := suffix_number + 1;
                    free_name := rtrim(left(account.name, 32 - length(' ' || suffix_number))) || ' ' || suffix_number;
                    EXIT WHEN NOT EXISTS (
                        SELECT 1 FROM accounts
                        WHERE user_id = account.user_id
                          AND status = 'ACTIVE'
                          AND kind IN ('ASSET', 'LIABILITY')
                          AND classification_id IS NOT DISTINCT FROM account.classification_id
                          AND lower(name) = lower(free_name)
                    );
                END LOOP;
                UPDATE accounts SET name = free_name WHERE id = account.id;
            END LOOP;
        END
        $$;
    """)
    op.execute("UPDATE accounts SET kind = 'ASSET' WHERE kind = 'LIABILITY'")
    op.alter_column(
        "accounts", "kind", existing_type=LEGACY_ACCOUNT_KINDS, type_=ACCOUNT_KINDS, existing_nullable=False
    )

    op.drop_constraint("account_classification_by_kind", "accounts", type_="check")
    op.drop_constraint("account_currency_by_kind", "accounts", type_="check")
    op.drop_constraint("account_color_by_kind", "accounts", type_="check")
    op.create_check_constraint(
        "account_classification_by_kind", "accounts", "classification_id IS NULL OR kind IN ('ASSET', 'EXPENSE')"
    )
    op.create_check_constraint("account_currency_by_kind", "accounts", "(currency IS NOT NULL) = (kind = 'ASSET')")
    op.create_check_constraint("account_color_by_kind", "accounts", "color IS NULL OR kind = 'ASSET'")

    op.create_index(
        "account_unique_user_id_kind_name",
        "accounts",
        ["user_id", "kind", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE' AND kind <> 'ASSET'"),
    )
    op.create_index(
        "account_unique_user_id_classification_id_name",
        "accounts",
        ["user_id", "classification_id", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_nulls_not_distinct=True,
        postgresql_where=sa.text("status = 'ACTIVE' AND kind = 'ASSET'"),
    )


def downgrade() -> None:
    op.drop_index("account_unique_user_id_classification_id_name", table_name="accounts")
    op.drop_index("account_unique_user_id_kind_name", table_name="accounts")

    op.drop_constraint("account_color_by_kind", "accounts", type_="check")
    op.drop_constraint("account_currency_by_kind", "accounts", type_="check")
    op.drop_constraint("account_classification_by_kind", "accounts", type_="check")
    op.create_check_constraint(
        "account_classification_by_kind",
        "accounts",
        "classification_id IS NULL OR kind IN ('ASSET', 'LIABILITY', 'EXPENSE')",
    )
    op.create_check_constraint(
        "account_currency_by_kind", "accounts", "(currency IS NOT NULL) = (kind IN ('ASSET', 'LIABILITY'))"
    )
    op.create_check_constraint("account_color_by_kind", "accounts", "color IS NULL OR kind IN ('ASSET', 'LIABILITY')")

    op.alter_column(
        "accounts", "kind", existing_type=ACCOUNT_KINDS, type_=LEGACY_ACCOUNT_KINDS, existing_nullable=False
    )
    op.create_index(
        "account_unique_user_id_kind_name",
        "accounts",
        ["user_id", "kind", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
