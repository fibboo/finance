from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.exceptions.not_implemented_501 import NotImplementedException
from app.exceptions.unprocessable_422 import MovementNotAllowed
from app.schemas.accounting.account import AccountKind
from app.schemas.error_response import ErrorCodeType
from app.services.accounting.transaction_processor import factory


async def test_get_processor_unknown_transaction_type(db: AsyncSession):
    # Arrange
    transaction_type: str = "LOAN"

    # Act / Assert
    with pytest.raises(NotImplementedException) as exc:
        factory.get_processor(db=db, user_id=uuid4(), transaction_type=transaction_type)

    assert exc.value.status_code == status.HTTP_501_NOT_IMPLEMENTED
    assert exc.value.error_code == ErrorCodeType.NOT_IMPLEMENTED
    assert exc.value.log_message == "Transaction LOAN is not implemented"


@pytest.mark.parametrize(
    "from_kind, to_kind",
    [
        (AccountKind.EXPENSE, AccountKind.ASSET),
        (AccountKind.ASSET, AccountKind.INCOME),
        (AccountKind.INCOME, AccountKind.EXPENSE),
        (AccountKind.EXPENSE, AccountKind.EXPENSE),
        (AccountKind.EQUITY, AccountKind.ASSET),
        (AccountKind.ASSET, AccountKind.EQUITY),
    ],
)
async def test_get_movement_processor_movement_not_allowed(
    db: AsyncSession, from_kind: AccountKind, to_kind: AccountKind
):
    # Act / Assert
    with pytest.raises(MovementNotAllowed) as exc:
        factory.get_movement_processor(db=db, user_id=uuid4(), from_kind=from_kind, to_kind=to_kind)

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert exc.value.error_code == ErrorCodeType.MOVEMENT_NOT_ALLOWED
    assert exc.value.log_message == (
        f"Money can not move from a {from_kind.value} account to a {to_kind.value} account"
    )
