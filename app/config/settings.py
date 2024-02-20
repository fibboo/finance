import os

from app.schemas.base import EnumLowerBase
from pydantic_settings import BaseSettings


class EnvironmentType(EnumLowerBase):
    DEV = 'dev'
    PROD = 'prod'


class Settings(BaseSettings):
    environment: EnvironmentType

    db_user: str
    db_password: str
    db_host: str
    db_port: int
    db_name: str

    telegram_token: str
    telegram_client_id: str
    session_expire_seconds: int


settings = Settings(_env_file=os.getenv('APP_CONFIG'), _env_file_encoding='utf-8')
