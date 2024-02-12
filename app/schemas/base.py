from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict


class EnumUpperBase(str, Enum):
    @classmethod
    def _missing_(cls, value):
        for member in cls:
            if member.value == value.upper():
                return member
        return None

    def __str__(self):
        return self.value.upper()

    @classmethod
    def values(cls) -> list[str]:
        value_list = list(map(lambda c: c.value, cls))
        return value_list


class EnumLowerBase(str, Enum):
    @classmethod
    def _missing_(cls, value):
        for member in cls:
            if member.value == value.lower():
                return member
        return None

    def __str__(self):
        return self.value.lower()

    @classmethod
    def values(cls) -> list[str]:
        value_list = list(map(lambda c: c.value, cls))
        return value_list


class EntityStatusType(EnumUpperBase):
    ACTIVE = 'ACTIVE'
    DELETED = 'DELETED'


class CurrencyType(EnumUpperBase):
    USD = 'USD'
    GEL = 'GEL'
    TRY = 'GEL'
    RUB = 'RUB'


class BaseServiceModel(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: lambda v: float(v)})
