import sqlalchemy as sa
from alembic import op

revision: str = "6f417f37d6f9"
down_revision: str = "9d678ac4c332"
branch_labels: None = None
depends_on: None = None

DEFAULT_CLASSIFICATIONS = "('MONEY_ACCOUNT', 'Asset'), ('EXPENSE_CATEGORY', 'Variable')"
LEGACY_CLASSIFICATIONS = """
    SELECT accounts.id, accounts.user_id,
           CASE WHEN kind = 'EXPENSE' THEN 'EXPENSE_CATEGORY' ELSE 'MONEY_ACCOUNT' END AS kind,
           initcap(CASE WHEN kind = 'EXPENSE' THEN category_type ELSE kind END) AS name
    FROM accounts JOIN users ON users.id = accounts.user_id
    WHERE kind IN ('ASSET', 'LIABILITY', 'EXPENSE')
"""


def upgrade() -> None:
    op.create_table(
        "classifications",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("MONEY_ACCOUNT", "EXPENSE_CATEGORY", name="classificationkind", native_enum=False),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "id"),
    )
    op.create_index(
        "classification_unique_user_kind_default",
        "classifications",
        ["user_id", "kind"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.create_index(
        "classification_unique_user_kind_name",
        "classifications",
        ["user_id", "kind", sa.text("lower(name)")],
        unique=True,
    )
    op.add_column("accounts", sa.Column("classification_id", sa.UUID(), nullable=True))
    op.create_index("ix_accounts_classification_id", "accounts", ["classification_id"])
    op.create_foreign_key(
        "account_classification_owner_fk",
        "accounts",
        "classifications",
        ["user_id", "classification_id"],
        ["user_id", "id"],
    )
    op.create_check_constraint(
        "account_classification_by_kind",
        "accounts",
        "classification_id IS NULL OR kind IN ('ASSET', 'LIABILITY', 'EXPENSE')",
    )

    op.execute(f"""
        CREATE FUNCTION create_user_default_classifications() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO classifications (user_id, kind, name, is_default)
            SELECT NEW.id, kind, name, true FROM (VALUES {DEFAULT_CLASSIFICATIONS}) AS defaults(kind, name);
            RETURN NEW;
        END
        $$;
        CREATE TRIGGER user_default_classifications
        AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_user_default_classifications();
    """)
    op.execute(f"""
        INSERT INTO classifications (user_id, kind, name, is_default)
        SELECT users.id, defaults.kind, defaults.name, true
        FROM users CROSS JOIN (VALUES {DEFAULT_CLASSIFICATIONS}) AS defaults(kind, name);
        INSERT INTO classifications (user_id, kind, name)
        SELECT DISTINCT user_id, kind, name FROM ({LEGACY_CLASSIFICATIONS}) AS legacy
        ON CONFLICT (user_id, kind, lower(name)) DO NOTHING;
    """)
    op.execute(f"""
        UPDATE accounts SET classification_id = classifications.id
        FROM ({LEGACY_CLASSIFICATIONS}) AS legacy
        JOIN classifications USING (user_id, kind, name)
        WHERE accounts.id = legacy.id;
    """)
    op.execute("""
        CREATE FUNCTION assign_legacy_account_classification() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            classification_kind classifications.kind%TYPE;
            classification_name classifications.name%TYPE;
        BEGIN
            IF NEW.kind NOT IN ('ASSET', 'LIABILITY', 'EXPENSE') THEN
                RETURN NEW;
            END IF;

            IF TG_OP = 'UPDATE' THEN
                IF NEW.user_id = OLD.user_id OR NEW.classification_id IS DISTINCT FROM OLD.classification_id THEN
                    RETURN NEW;
                END IF;
            ELSIF NEW.classification_id IS NOT NULL THEN
                RETURN NEW;
            END IF;

            PERFORM id FROM users WHERE id = NEW.user_id FOR UPDATE;
            IF NOT FOUND THEN
                RETURN NEW;
            END IF;

            IF TG_OP = 'UPDATE' AND OLD.classification_id IS NOT NULL THEN
                SELECT kind, name INTO classification_kind, classification_name
                FROM classifications WHERE id = OLD.classification_id;
                INSERT INTO classifications (user_id, kind, name)
                VALUES (NEW.user_id, classification_kind, classification_name)
                ON CONFLICT (user_id, kind, lower(name)) DO NOTHING;
            ELSE
                classification_kind := CASE WHEN NEW.kind = 'EXPENSE' THEN 'EXPENSE_CATEGORY' ELSE 'MONEY_ACCOUNT' END;
                classification_name := initcap(CASE WHEN NEW.kind = 'EXPENSE' THEN NEW.category_type ELSE NEW.kind END);
            END IF;

            SELECT id INTO NEW.classification_id
            FROM classifications
            WHERE user_id = NEW.user_id AND kind = classification_kind
              AND (lower(name) = lower(classification_name) OR is_default)
            ORDER BY (lower(name) = lower(classification_name)) DESC NULLS LAST
            LIMIT 1;
            RETURN NEW;
        END
        $$;
        CREATE TRIGGER legacy_account_classification
        BEFORE INSERT OR UPDATE OF user_id ON accounts
        FOR EACH ROW EXECUTE FUNCTION assign_legacy_account_classification();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER legacy_account_classification ON accounts")
    op.execute("DROP FUNCTION assign_legacy_account_classification()")
    op.execute("DROP TRIGGER user_default_classifications ON users")
    op.execute("DROP FUNCTION create_user_default_classifications()")
    op.drop_constraint("account_classification_by_kind", "accounts", type_="check")
    op.drop_constraint("account_classification_owner_fk", "accounts", type_="foreignkey")
    op.drop_index("ix_accounts_classification_id", table_name="accounts")
    op.drop_column("accounts", "classification_id")
    op.drop_table("classifications")
