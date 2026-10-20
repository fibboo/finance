from pydantic import BaseModel

from app.schemas.accounting.dictionary import DictionaryItem


class UserDictionaries(BaseModel):
    provider_types: list[DictionaryItem]
