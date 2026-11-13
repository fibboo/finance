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
