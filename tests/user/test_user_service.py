import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.user import user_crud
from app.models import User
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.services.user.user_service import get_user_base_currency


@pytest.mark.asyncio
async def test_get_user_base_currency(db_fixture: AsyncSession):
    # Given
    user_create = User(username='test', registration_provider=ProviderType.TELEGRAM)
    user_db: User = await user_crud.create(db=db_fixture, obj_in=user_create, commit=True)

    # When
    base_currency: CurrencyType = await get_user_base_currency(db=db_fixture, user_id=user_db.id)

    # Then
    assert base_currency == CurrencyType.USD
