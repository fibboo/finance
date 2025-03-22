from enum import Enum

from pydantic_settings import BaseSettings


class EnvironmentType(str, Enum):
    DEV = 'dev'
    PROD = 'prod'
    LOCAL = 'local'


class Settings(BaseSettings):
    environment: EnvironmentType = EnvironmentType.LOCAL
    session_expire_seconds: int = 60 * 60 * 24 * 7

    max_accounts_per_user: int = 10


settings = Settings()


class DatabaseSettings(BaseSettings):
    database_url: str = 'postgresql+asyncpg://user:password@localhost:5432/finance'

    def db_sync_url(self):
        return self.database_url.replace('postgresql+asyncpg://', 'postgresql+psycopg2://')


database_settings = DatabaseSettings()


class TelegramSettings(BaseSettings):
    token: str = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    bot_name: str = 'bot_name'

    class Config:
        env_prefix = 'telegram_'


telegram_settings = TelegramSettings()
