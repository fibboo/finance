import pytest_asyncio
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.accounting.currency import Currency
from app.models.base import Base

CURRENCIES: list[dict[str, str]] = [
    {"code": "USD", "name": "US Dollar"},
    {"code": "EUR", "name": "Euro"},
    {"code": "RSD", "name": "Serbian Dinar"},
    {"code": "GEL", "name": "Georgian Lari"},
    {"code": "TRY", "name": "Turkish Lira"},
    {"code": "RUB", "name": "Russian Ruble"},
]


@pytest_asyncio.fixture
async def engine(postgresql):
    connection = f"postgresql+asyncpg://{postgresql.info.user}:@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    engine = create_async_engine(connection)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(insert(Currency), CURRENCIES)

    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(engine):
    session_maker = async_sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False)

    try:
        async with session_maker() as session:
            yield session

    finally:
        await session.commit()
        await session.close()


@pytest_asyncio.fixture
async def db_transaction(engine):
    session_maker = async_sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False)
    try:
        async with session_maker.begin() as session:
            yield session
    finally:
        await session.commit()
        await session.close()


@pytest_asyncio.fixture
async def other_db_transaction(engine):
    session_maker = async_sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False)
    try:
        async with session_maker.begin() as session:
            yield session
    finally:
        await session.commit()
        await session.close()
