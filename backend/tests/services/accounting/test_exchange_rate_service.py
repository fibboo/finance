from decimal import Decimal

import pytest
from pytest_httpx import HTTPXMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import exchange_rate_settings
from app.crud.user.user import user_crud
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyCode
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.accounting.exchange_rate_service import get_base_currency_rates, get_estimate

EXCHANGE_RATES_URL: str = "https://open.er-api.test/v6/latest/USD"


async def test_get_base_currency_rates_ok(db: AsyncSession, httpx_mock: HTTPXMock):
    # arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="EUR"),
        commit=True,
    )
    httpx_mock.add_response(
        method="GET",
        url=EXCHANGE_RATES_URL,
        json={"result": "success", "base_code": "USD", "rates": {"USD": 1, "EUR": 0.8, "RSD": 100}},
    )

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {"USD": Decimal("0.8"), "EUR": Decimal("1"), "RSD": Decimal("0.008")}


async def test_get_base_currency_rates_cached(db: AsyncSession, httpx_mock: HTTPXMock):
    # arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    httpx_mock.add_response(
        method="GET", url=EXCHANGE_RATES_URL, json={"result": "success", "rates": {"USD": 1, "EUR": 0.8}}
    )
    await get_base_currency_rates(db=db, user_id=user_db.id)

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {"USD": Decimal("1"), "EUR": Decimal("1.25")}
    assert len(httpx_mock.get_requests()) == 1


async def test_get_base_currency_rates_expired(
    db: AsyncSession, httpx_mock: HTTPXMock, monkeypatch: pytest.MonkeyPatch
):
    # arrange
    monkeypatch.setattr(exchange_rate_settings, "cache_seconds", 0)
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    httpx_mock.add_response(
        method="GET", url=EXCHANGE_RATES_URL, json={"result": "success", "rates": {"USD": 1, "EUR": 0.8}}
    )
    httpx_mock.add_response(
        method="GET", url=EXCHANGE_RATES_URL, json={"result": "success", "rates": {"USD": 1, "EUR": 0.5}}
    )
    await get_base_currency_rates(db=db, user_id=user_db.id)

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {"USD": Decimal("1"), "EUR": Decimal("2")}


@pytest.mark.parametrize(
    "response",
    [
        {"status_code": 503},
        {"json": {"result": "error", "error-type": "invalid-key"}},
        {"json": {"result": "success", "rates": {"USD": 0}}},
        {"text": "not json"},
    ],
)
async def test_get_base_currency_rates_provider_failure(db: AsyncSession, httpx_mock: HTTPXMock, response: dict):
    # arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    httpx_mock.add_response(method="GET", url=EXCHANGE_RATES_URL, **response)

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {}


async def test_get_base_currency_rates_keeps_cache_on_failure(
    db: AsyncSession, httpx_mock: HTTPXMock, monkeypatch: pytest.MonkeyPatch
):
    # arrange
    monkeypatch.setattr(exchange_rate_settings, "cache_seconds", 0)
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    httpx_mock.add_response(
        method="GET", url=EXCHANGE_RATES_URL, json={"result": "success", "rates": {"USD": 1, "EUR": 0.8}}
    )
    httpx_mock.add_response(method="GET", url=EXCHANGE_RATES_URL, status_code=503)
    await get_base_currency_rates(db=db, user_id=user_db.id)

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {"USD": Decimal("1"), "EUR": Decimal("1.25")}


async def test_get_base_currency_rates_base_currency_not_set(db: AsyncSession, httpx_mock: HTTPXMock):
    # arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM), commit=True
    )

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {}
    assert httpx_mock.get_requests() == []


async def test_get_base_currency_rates_base_currency_not_quoted(db: AsyncSession, httpx_mock: HTTPXMock):
    # arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="estimates", registration_provider=ProviderType.TELEGRAM, base_currency="RSD"),
        commit=True,
    )
    httpx_mock.add_response(
        method="GET", url=EXCHANGE_RATES_URL, json={"result": "success", "rates": {"USD": 1, "EUR": 0.8}}
    )

    # act
    base_currency_rates: dict[CurrencyCode, Decimal] = await get_base_currency_rates(db=db, user_id=user_db.id)

    # assert
    assert base_currency_rates == {}


@pytest.mark.parametrize(
    "amount, currency, expected_estimate",
    [
        (Decimal("-30"), "EUR", Decimal("-37.50")),
        (Decimal("1200"), "RSD", Decimal("10.26")),
        (Decimal("10"), "GEL", None),
    ],
)
def test_get_estimate(amount: Decimal, currency: CurrencyCode, expected_estimate: Decimal | None):
    # arrange
    base_currency_rates: dict[CurrencyCode, Decimal] = {"EUR": Decimal("1.25"), "RSD": Decimal("0.00855")}

    # act
    estimate: Decimal | None = get_estimate(amount=amount, currency=currency, base_currency_rates=base_currency_rates)

    # assert
    assert estimate == expected_estimate
