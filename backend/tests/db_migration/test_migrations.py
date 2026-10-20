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
