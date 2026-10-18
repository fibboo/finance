from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.currency import currency_crud
from app.schemas.accounting.dictionary import AccountingDictionaries, DictionaryItem
from app.services.accounting import dictionary_service


async def test_get_accounting_dictionaries(db: AsyncSession):
    # Arrange
    await currency_crud.create_batch(
        db=db,
        objs_in=[
            {"code": "USD", "name": "US Dollar"},
            {"code": "EUR", "name": "Euro"},
            {"code": "RSD", "name": "Serbian Dinar"},
        ],
        commit=True,
    )

    # Act
    dictionaries: AccountingDictionaries = await dictionary_service.get_accounting_dictionaries(db=db)

    # Assert
    assert dictionaries.currencies == [
        DictionaryItem(key="EUR", label="Euro"),
        DictionaryItem(key="RSD", label="Serbian Dinar"),
        DictionaryItem(key="USD", label="US Dollar"),
    ]


async def test_get_accounting_dictionaries_without_currencies(db: AsyncSession):
    # Act
    dictionaries: AccountingDictionaries = await dictionary_service.get_accounting_dictionaries(db=db)

    # Assert
    assert dictionaries.currencies == []
