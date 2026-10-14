from enum import Enum

from pydantic_settings import BaseSettings, SettingsConfigDict


class EnvironmentType(str, Enum):
    DEV = "dev"
    PROD = "prod"
    LOCAL = "local"


class Settings(BaseSettings):
    environment: EnvironmentType
    app_title: str

    session_expire_seconds: int
    max_accounts_per_user: int

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()


class DatabaseSettings(BaseSettings):
    database_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def db_sync_url(self):
        return self.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


database_settings = DatabaseSettings()


class TelegramSettings(BaseSettings):
    token: str
    bot_name: str

    model_config = SettingsConfigDict(env_prefix="telegram_", env_file=".env", extra="ignore")


telegram_settings = TelegramSettings()
