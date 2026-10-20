from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.currency import currency_crud
from app.models.accounting.currency import Currency as CurrencyModel
from app.schemas.accounting.category import CATEGORY_TYPE_LABELS, CategoryType
from app.schemas.accounting.dictionary import AccountingDictionaries
from app.schemas.dictionary import DictionaryItem


async def get_accounting_dictionaries(*, db: AsyncSession) -> AccountingDictionaries:
    currencies_db: list[CurrencyModel] = await currency_crud.get_currencies(db=db)
    currencies: list[DictionaryItem] = []
    for currency_db in currencies_db:
        currencies.append(DictionaryItem(key=currency_db.code, label=currency_db.name))

    category_types: list[DictionaryItem] = []
    for category_type in CategoryType:
        category_types.append(DictionaryItem(key=category_type.value, label=CATEGORY_TYPE_LABELS[category_type]))

    dictionaries = AccountingDictionaries(currencies=currencies, category_types=category_types)
    return dictionaries
