from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.exceptions.conflict_409 import IntegrityException
from app.models.accounting.account import Account as AccountModel
from app.schemas.base import CurrencyType

logger = get_logger(logger_name=__name__)


async def test_integrity_exception_not_null_names_the_column(db: AsyncSession):
    # Arrange
    obj_in = {"user_id": uuid4(), "name": None, "currency": CurrencyType.USD}
    with pytest.raises(IntegrityError) as integrity_error:
        await account_crud.create(db=db, obj_in=obj_in)
    await db.rollback()

    # Act
    exception = IntegrityException(entity=AccountModel, exception=integrity_error.value, logger=logger)

    # Assert
    assert exception.log_message == "Account integrity error: 23502 on accounts.name"
