from pydantic import BaseModel

from app.schemas.dictionary import DictionaryItem


class AccountingDictionaries(BaseModel):
    currencies: list[DictionaryItem]
    category_purposes: list[DictionaryItem] | None = None
    transaction_types: list[DictionaryItem]
    transaction_orders: list[DictionaryItem]
