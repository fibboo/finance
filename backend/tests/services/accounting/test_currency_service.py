import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.not_fount_404 import EntityNotFound
from app.schemas.accounting.currency import Currency
from app.schemas.error_response import ErrorCodeType
from app.services.accounting.currency_service import get_currency


async def test_get_currency(db: AsyncSession):
    # Act
    currency: Currency = await get_currency(db=db, code="RSD")

    # Assert
    assert currency == Currency(code="RSD", name="Serbian Dinar")


async def test_get_currency_unknown_code(db: AsyncSession):
    # Act / Assert
    with pytest.raises(EntityNotFound) as exc:
        await get_currency(db=db, code="XXX")

    assert exc.value.error_code == ErrorCodeType.ENTITY_NOT_FOUND
    assert exc.value.log_message == "Currency not found by {'code': 'XXX'}"
