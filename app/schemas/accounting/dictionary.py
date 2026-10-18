from pydantic import BaseModel


class DictionaryItem(BaseModel):
    key: str
    label: str


class AccountingDictionaries(BaseModel):
    currencies: list[DictionaryItem]
    category_types: list[DictionaryItem]
