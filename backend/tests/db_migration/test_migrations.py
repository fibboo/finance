from alembic import command
from alembic.config import Config

from app.configs.settings import database_settings


def test_migrations_match_models(postgresql, monkeypatch):
    # arrange
    database_url = f"postgresql+asyncpg://{postgresql.info.user}:@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    monkeypatch.setattr(database_settings, "database_url", database_url)
    alembic_config = Config("alembic.ini")

    # act
    command.upgrade(alembic_config, "head")

    # assert
    command.check(alembic_config)

    # act
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")

    # assert
    command.check(alembic_config)


def test_head_revision_applies_to_stored_transactions(postgresql, monkeypatch):
    # arrange
    database_url = f"postgresql+asyncpg://{postgresql.info.user}:@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    monkeypatch.setattr(database_settings, "database_url", database_url)
    alembic_config = Config("alembic.ini")
    command.upgrade(alembic_config, "head")

    # a stored transaction queues the deferred transaction_valuation trigger when a revision updates its row
    postgresql.execute(
        "INSERT INTO transactions (user_id, transaction_type, transaction_date) "
        "VALUES (uuidv7(), 'TRANSFER', '2026-01-01')"
    )
    postgresql.commit()
    command.downgrade(alembic_config, "-1")

    # act
    command.upgrade(alembic_config, "head")

    # assert
    command.check(alembic_config)
    transaction_count = postgresql.execute("SELECT count(*) FROM transactions").fetchone()[0]
    assert transaction_count == 1


def test_name_case_insensitive_revision_renames_active_case_duplicates(postgresql, monkeypatch):
    # arrange
    database_url = f"postgresql+asyncpg://{postgresql.info.user}:@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    monkeypatch.setattr(database_settings, "database_url", database_url)
    alembic_config = Config("alembic.ini")
    command.upgrade(alembic_config, "9a4d2b7e6c15")

    # the oldest active name stays, a later one in another case takes the first free number in any case,
    # another kind, a deleted row and another user keep their names, and a cut name loses its trailing space
    user_id = "0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11"
    other_user_id = "1d7b4a52-0b5c-4f1e-9f3a-2f1a6f0c8d12"
    accounts = [
        (user_id, "INCOME", "Freelance", "ACTIVE", "2026-01-01"),
        (user_id, "INCOME", "freelance", "ACTIVE", "2026-01-02"),
        (user_id, "INCOME", "FREELANCE", "ACTIVE", "2026-01-03"),
        (user_id, "INCOME", "freelance 2", "ACTIVE", "2026-01-04"),
        (user_id, "INCOME", "FREELANCE", "DELETED", "2026-01-05"),
        (other_user_id, "INCOME", "FREELANCE", "ACTIVE", "2026-01-06"),
        (user_id, "INCOME", "Groceries and household goods ab", "ACTIVE", "2026-01-07"),
        (user_id, "INCOME", "GROCERIES AND HOUSEHOLD GOODS AB", "ACTIVE", "2026-01-08"),
    ]
    for account in accounts:
        postgresql.execute(
            "INSERT INTO accounts (user_id, kind, name, status, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (*account, account[-1]),
        )

    postgresql.execute(
        "INSERT INTO accounts (user_id, kind, name, category_type, created_at, updated_at) "
        "VALUES (%s, 'EXPENSE', 'FREELANCE', 'VARIABLE', '2026-01-09', '2026-01-09')",
        (user_id,),
    )
    for name, created_at in (("Old market", "2026-01-01"), ("OLD MARKET", "2026-01-02")):
        postgresql.execute(
            "INSERT INTO locations (user_id, name, created_at, updated_at) VALUES (%s, %s, %s, %s)",
            (user_id, name, created_at, created_at),
        )

    postgresql.commit()

    # act
    command.upgrade(alembic_config, "3e7b1c9d5a42")

    # assert
    account_names = postgresql.execute(
        "SELECT user_id::text, kind, name, status FROM accounts ORDER BY created_at"
    ).fetchall()
    assert account_names == [
        (user_id, "INCOME", "Freelance", "ACTIVE"),
        (user_id, "INCOME", "freelance 3", "ACTIVE"),
        (user_id, "INCOME", "FREELANCE 4", "ACTIVE"),
        (user_id, "INCOME", "freelance 2", "ACTIVE"),
        (user_id, "INCOME", "FREELANCE", "DELETED"),
        (other_user_id, "INCOME", "FREELANCE", "ACTIVE"),
        (user_id, "INCOME", "Groceries and household goods ab", "ACTIVE"),
        (user_id, "INCOME", "GROCERIES AND HOUSEHOLD GOODS 2", "ACTIVE"),
        (user_id, "EXPENSE", "FREELANCE", "ACTIVE"),
    ]
    location_names = postgresql.execute("SELECT name FROM locations ORDER BY created_at").fetchall()
    assert location_names == [("Old market",), ("OLD MARKET 2",)]


def test_category_purpose_revision_backfills_and_accepts_legacy_writes(postgresql, monkeypatch):
    # arrange
    database_url = f"postgresql+asyncpg://{postgresql.info.user}:@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    monkeypatch.setattr(database_settings, "database_url", database_url)
    alembic_config = Config("alembic.ini")
    command.upgrade(alembic_config, "3e7b1c9d5a42")
    user_id = "0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11"
    for name, category_status in [("Active", "ACTIVE"), ("Deleted", "DELETED")]:
        postgresql.execute(
            "INSERT INTO accounts (user_id, kind, name, category_type, status) VALUES (%s, 'EXPENSE', %s, 'FIXED', %s)",
            (user_id, name, category_status),
        )
    postgresql.execute(
        "INSERT INTO accounts (user_id, kind, name, currency) VALUES (%s, 'ASSET', 'Wallet', 'USD')", (user_id,)
    )
    postgresql.commit()

    # act
    command.upgrade(alembic_config, "9d678ac4c332")

    # assert
    rows = postgresql.execute("SELECT name, category_purpose FROM accounts ORDER BY name").fetchall()
    assert rows == [("Active", "PERSONAL"), ("Deleted", "PERSONAL"), ("Wallet", None)]
    postgresql.execute(
        "INSERT INTO accounts (user_id, kind, name, category_type) VALUES (%s, 'EXPENSE', 'Legacy', 'FIXED')",
        (user_id,),
    )
    postgresql.commit()
    assert postgresql.execute("SELECT category_purpose FROM accounts WHERE name = 'Legacy'").fetchone() == (None,)


def test_classification_revision_preserves_assignments_and_legacy_writes(postgresql, monkeypatch):
    # arrange
    database_url = f"postgresql+asyncpg://{postgresql.info.user}:@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    monkeypatch.setattr(database_settings, "database_url", database_url)
    alembic_config = Config("alembic.ini")
    command.upgrade(alembic_config, "9d678ac4c332")
    user_id = postgresql.execute(
        "INSERT INTO users (username, registration_provider) VALUES ('first-owner', 'TELEGRAM') RETURNING id"
    ).fetchone()[0]
    entries = [
        ("Wallet", "ASSET", "USD", None, None, "ACTIVE", 200, "Asset"),
        ("Card", "LIABILITY", "USD", None, None, "ACTIVE", -30, "Liability"),
        ("Rent", "EXPENSE", None, "FIXED", "PERSONAL", "ACTIVE", 0, "Fixed"),
        ("Food", "EXPENSE", None, "VARIABLE", "PERSONAL", "ACTIVE", 0, "Variable"),
        ("Travel", "EXPENSE", None, "PERIODIC", "INCOME_COST", "DELETED", 0, "Periodic"),
        ("Salary", "INCOME", None, None, None, "ACTIVE", 0, None),
    ]
    expected = []
    for name, kind, currency, category_type, purpose, status, balance, classification_name in entries:
        account_id = postgresql.execute(
            "INSERT INTO accounts (user_id, name, kind, currency, category_type, category_purpose, status, balance) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (user_id, name, kind, currency, category_type, purpose, status, balance),
        ).fetchone()[0]
        expected.append((account_id, name, kind, category_type, purpose, status, balance, classification_name))

    postgresql.commit()

    # act
    command.upgrade(alembic_config, "head")

    # assert
    accounts = postgresql.execute(
        "SELECT a.id, a.name, a.kind, a.category_type, a.category_purpose, a.status, a.balance, c.name "
        "FROM accounts a LEFT JOIN classifications c ON c.id = a.classification_id ORDER BY a.id"
    ).fetchall()
    assert accounts == expected
    other_user_id = postgresql.execute(
        "INSERT INTO users (username, registration_provider) VALUES ('second-owner', 'GOOGLE') RETURNING id"
    ).fetchone()[0]
    defaults = postgresql.execute(
        "SELECT kind, name, is_default FROM classifications WHERE user_id = %s ORDER BY kind", (other_user_id,)
    ).fetchall()
    assert defaults == [("EXPENSE_CATEGORY", "Variable", True), ("MONEY_ACCOUNT", "Asset", True)]

    postgresql.execute(
        "INSERT INTO accounts (user_id, kind, name, currency) VALUES (%s, 'ASSET', 'Legacy Wallet', 'USD')",
        (other_user_id,),
    )
    postgresql.execute("UPDATE accounts SET user_id = %s WHERE name = 'Travel'", (other_user_id,))
    postgresql.commit()
    assignments = postgresql.execute(
        "SELECT a.name, c.user_id, c.name FROM accounts a JOIN classifications c ON c.id = a.classification_id "
        "WHERE a.name IN ('Legacy Wallet', 'Travel') ORDER BY a.name"
    ).fetchall()
    assert assignments == [("Legacy Wallet", other_user_id, "Asset"), ("Travel", other_user_id, "Periodic")]
