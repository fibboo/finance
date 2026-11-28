from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.accounting.dictionary import AccountingDictionaries
from app.schemas.dictionary import DictionaryItem
from app.services.accounting import dictionary_service


async def test_get_accounting_dictionaries(db: AsyncSession):
    # Act
    dictionaries: AccountingDictionaries = await dictionary_service.get_accounting_dictionaries(db=db)

    # Assert
    # the currencies come from the rows the engine fixture inserts, in the positions the currency position revision sets
    assert dictionaries.currencies == [
        DictionaryItem(key="USD", label="US Dollar"),
        DictionaryItem(key="EUR", label="Euro"),
        DictionaryItem(key="RSD", label="Serbian Dinar"),
        DictionaryItem(key="GEL", label="Georgian Lari"),
        DictionaryItem(key="TRY", label="Turkish Lira"),
        DictionaryItem(key="RUB", label="Russian Ruble"),
    ]
    assert dictionaries.transaction_types == [
        DictionaryItem(key="EXPENSE", label="Expense"),
        DictionaryItem(key="INCOME", label="Income"),
        DictionaryItem(key="TRANSFER", label="Transfer"),
        DictionaryItem(key="ADJUSTMENT", label="Adjustment"),
    ]
    assert dictionaries.transaction_orders == [
        DictionaryItem(key="transaction_date:desc", label="Newest first"),
        DictionaryItem(key="transaction_date:asc", label="Oldest first"),
        DictionaryItem(key="base_currency_amount:desc", label="Largest first"),
        DictionaryItem(key="base_currency_amount:asc", label="Smallest first"),
    ]
