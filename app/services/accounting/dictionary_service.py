from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.currency import currency_crud
from app.models.accounting.currency import Currency as CurrencyModel
from app.schemas.accounting.dictionary import AccountingDictionaries, DictionaryItem


async def get_accounting_dictionaries(*, db: AsyncSession) -> AccountingDictionaries:
    currencies_db: list[CurrencyModel] = await currency_crud.get_currencies(db=db)
    currencies: list[DictionaryItem] = []
    for currency_db in currencies_db:
        currencies.append(DictionaryItem(key=currency_db.code, label=currency_db.name))

    dictionaries = AccountingDictionaries(currencies=currencies)
    return dictionaries
