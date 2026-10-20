from pydantic import BaseModel


class DictionaryItem(BaseModel):
    key: str
    label: str
