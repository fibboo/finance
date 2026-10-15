from uuid import UUID, uuid4

from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.accounting.income_source import IncomeSource, IncomeSourceCreateRequest, IncomeSourceRequest
from app.services.accounting import income_service


async def test_get_income_sources_more_than_twenty(db: AsyncSession):
    # Arrange
    user_id: UUID = uuid4()
    for i in range(25):
        create_data: IncomeSourceCreateRequest = IncomeSourceCreateRequest(name=f"Income source {i:02}")
        await income_service.create_income_source(db=db, create_data=create_data, user_id=user_id)
    await db.commit()

    request: IncomeSourceRequest = IncomeSourceRequest(size=10, page=3)

    # Act
    income_sources: Page[IncomeSource] = await income_service.get_income_sources(
        db=db, request=request, user_id=user_id
    )

    # Assert
    assert income_sources.total == 25
    assert income_sources.pages == 3
    assert [income_source.name for income_source in income_sources.items] == [
        f"Income source {i}" for i in range(20, 25)
    ]
