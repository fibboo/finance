"""drop_category_type

Revision ID: ea2313c6598d
Revises: 3c68d022c920
Create Date: 2026-11-28 03:39:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ea2313c6598d"
down_revision: Union[str, None] = "3c68d022c920"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TRIGGER legacy_account_classification ON accounts")
    op.execute("DROP FUNCTION assign_legacy_account_classification()")
    op.drop_column("accounts", "category_type")


def downgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column(
            "category_type",
            sa.Enum("VARIABLE", "FIXED", "PERIODIC", name="categorytype", native_enum=False),
            nullable=True,
        ),
    )
    op.execute("""
        UPDATE accounts SET category_type = upper(classifications.name)
        FROM classifications
        WHERE classifications.id = accounts.classification_id
          AND accounts.kind = 'EXPENSE'
          AND upper(classifications.name) IN ('VARIABLE', 'FIXED', 'PERIODIC')
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
