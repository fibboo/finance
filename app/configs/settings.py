from pydantic_settings import BaseSettings

from app.schemas.base import EnumLowerBase


class EnvironmentType(EnumLowerBase):
    DEV = 'dev'
    PROD = 'prod'
    LOCAL = 'local'


class Settings(BaseSettings):
    environment: EnvironmentType = EnvironmentType.LOCAL
    session_expire_seconds: int = 60 * 60 * 24 * 7


base_settings = Settings()


class DatabaseSettings(BaseSettings):
    database_url: str = 'postgresql+asyncpg://user:password@postgres:5432/fibboo_finance'

    def db_sync_url(self):
        return self.database_url.replace('postgresql+asyncpg://', 'postgresql+psycopg2://')


database_settings = DatabaseSettings()


class TelegramSettings(BaseSettings):
    token: str = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    client_id: str = 'fibboo_finance_bot'

    class Config:
        env_prefix = 'telegram_'


telegram_settings = TelegramSettings()
