import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.user import user_crud
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import UserCreate
from app.services.user.user_service import get_user_base_currency


@pytest.mark.asyncio
async def test_get_user_base_currency(db_fixture: AsyncSession):
    # Arrange
    user_create_data: UserCreate = UserCreate(username='test',
                                              registration_provider=ProviderType.TELEGRAM,
                                              base_currency=CurrencyType.USD)
    user_db: UserModel = await user_crud.create(db=db_fixture, obj_in=user_create_data, commit=True)
    await db_fixture.commit()

    # Act
    base_currency: CurrencyType = await get_user_base_currency(db=db_fixture, user_id=user_db.id)

    # Assert
    assert base_currency == CurrencyType.USD
