from pydantic import BaseModel

from app.schemas.dictionary import DictionaryItem


class AccountingDictionaries(BaseModel):
    currencies: list[DictionaryItem]
    category_types: list[DictionaryItem]
