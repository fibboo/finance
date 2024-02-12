from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config.settings import settings

DATABASE_URL = (f"postgresql+asyncpg://{settings.db_user}:"
                f"{settings.db_password}@{settings.db_host}:"
                f"{settings.db_port}/{settings.db_name}")

engine = create_async_engine(DATABASE_URL,
                             pool_pre_ping=True,
                             pool_size=5,
                             max_overflow=50)

SessionLocal = async_sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False)
