from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.exceptions.not_implemented_501 import NotImplementedException
from app.schemas.error_response import ErrorCodeType
from app.services.accounting.transaction_processor.base import TransactionProcessor


async def test_factory_unknown_transaction_type(db: AsyncSession):
    # Arrange
    transaction_type: str = "LOAN"

    # Act / Assert
    with pytest.raises(NotImplementedException) as exc:
        TransactionProcessor.factory(db=db, user_id=uuid4(), transaction_type=transaction_type)

    assert exc.value.status_code == status.HTTP_501_NOT_IMPLEMENTED
    assert exc.value.error_code == ErrorCodeType.NOT_IMPLEMENTED
    assert exc.value.log_message == "Transaction LOAN is not implemented"
