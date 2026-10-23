from pydantic import BaseModel

from app.schemas.dictionary import DictionaryItem


class AccountingDictionaries(BaseModel):
    currencies: list[DictionaryItem]
    account_kinds: list[DictionaryItem]
    category_types: list[DictionaryItem]
    transaction_types: list[DictionaryItem]
    transaction_orders: list[DictionaryItem]
