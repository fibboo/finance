from enum import Enum

from pydantic_settings import BaseSettings, SettingsConfigDict


class EnvironmentType(str, Enum):
    DEV = "dev"
    PROD = "prod"
    LOCAL = "local"


class Settings(BaseSettings):
    environment: EnvironmentType
    app_title: str
    public_base_url: str
    allowed_redirect_uris: list[str]
    allowed_origins: list[str]

    jwt_secret: str
    access_token_expire_seconds: int
    refresh_token_expire_seconds: int

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()


class DatabaseSettings(BaseSettings):
    database_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def db_sync_url(self):
        return self.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


database_settings = DatabaseSettings()


class TelegramSettings(BaseSettings):
    client_id: str
    client_secret: str

    model_config = SettingsConfigDict(env_prefix="telegram_", env_file=".env", extra="ignore")


telegram_settings = TelegramSettings()


class GoogleSettings(BaseSettings):
    client_id: str
    client_secret: str

    model_config = SettingsConfigDict(env_prefix="google_", env_file=".env", extra="ignore")


google_settings = GoogleSettings()
