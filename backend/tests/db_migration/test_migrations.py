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
