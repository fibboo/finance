from enum import Enum


class EntityStatusType(str, Enum):
    ACTIVE = 'ACTIVE'
    DELETED = 'DELETED'


class CurrencyType(str, Enum):
    USD = 'USD'
    EUR = 'EUR'
    RSD = 'RSD'
    GEL = 'GEL'
    TRY = 'TRY'
    RUB = 'RUB'
