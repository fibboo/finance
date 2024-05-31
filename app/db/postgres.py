from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config.settings import database_settings

engine = create_async_engine(database_settings.database_url,
                             pool_pre_ping=True,
                             pool_size=5,
                             max_overflow=50)

SessionLocal = async_sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False)
