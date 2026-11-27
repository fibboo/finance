from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession, create_async_engine

from app.crud.accounting.classification import classification_crud
from app.crud.user.user import user_crud
from app.models.accounting.currency import Currency
from app.models.base import Base
from app.models.user.user import User
from app.schemas.accounting.classification import ClassificationKind
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.exchange_rate_service import exchange_rates_cache

CURRENCIES: list[dict[str, str | int]] = [
    {"code": "USD", "name": "US Dollar", "position": 1},
    {"code": "EUR", "name": "Euro", "position": 2},
    {"code": "RSD", "name": "Serbian Dinar", "position": 3},
    {"code": "GEL", "name": "Georgian Lari", "position": 4},
    {"code": "TRY", "name": "Turkish Lira", "position": 5},
    {"code": "RUB", "name": "Russian Ruble", "position": 6},
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


@pytest.fixture
def db_transaction_factory(engine) -> async_sessionmaker[AsyncSession]:
    session_maker = async_sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False)
    return session_maker


@pytest_asyncio.fixture
async def db_transaction(db_transaction_factory):
    session_maker: async_sessionmaker[AsyncSession] = db_transaction_factory
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


@pytest.fixture(autouse=True)
def empty_exchange_rates_cache():
    exchange_rates_cache.usd_rates = {}
    exchange_rates_cache.next_fetch_at = None


@pytest_asyncio.fixture
async def account_owner_id(db: AsyncSession) -> UUID:
    user: User = await user_crud.create(
        db=db, obj_in=UserCreate(username="account-owner", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    await classification_crud.create_batch(
        db=db,
        objs_in=[
            {"user_id": user.id, "kind": ClassificationKind.MONEY_ACCOUNT, "name": "Asset", "is_default": True},
            {"user_id": user.id, "kind": ClassificationKind.EXPENSE_CATEGORY, "name": "Variable", "is_default": True},
        ],
        commit=True,
    )
    return user.id
