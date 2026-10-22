from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.accounting.dictionary import AccountingDictionaries
from app.schemas.dictionary import DictionaryItem
from app.services.accounting import dictionary_service


async def test_get_accounting_dictionaries(db: AsyncSession):
    # Act
    dictionaries: AccountingDictionaries = await dictionary_service.get_accounting_dictionaries(db=db)

    # Assert
    # the currencies come from the rows the engine fixture inserts, as the initial revision does
    assert dictionaries.currencies == [
        DictionaryItem(key="EUR", label="Euro"),
        DictionaryItem(key="GEL", label="Georgian Lari"),
        DictionaryItem(key="RSD", label="Serbian Dinar"),
        DictionaryItem(key="RUB", label="Russian Ruble"),
        DictionaryItem(key="TRY", label="Turkish Lira"),
        DictionaryItem(key="USD", label="US Dollar"),
    ]
    assert dictionaries.account_kinds == [
        DictionaryItem(key="ASSET", label="Asset"),
        DictionaryItem(key="LIABILITY", label="Liability"),
        DictionaryItem(key="EQUITY", label="Equity"),
        DictionaryItem(key="INCOME", label="Income"),
        DictionaryItem(key="EXPENSE", label="Expense"),
    ]
    assert dictionaries.category_types == [
        DictionaryItem(key="VARIABLE", label="Variable"),
        DictionaryItem(key="FIXED", label="Fixed"),
        DictionaryItem(key="PERIODIC", label="Periodic"),
    ]
