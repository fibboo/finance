from enum import Enum

from pydantic import BaseModel


class EnumUpperBase(str, Enum):
    @classmethod
    def _missing_(cls, value):
        for member in cls:
            if member.value == value.upper():
                return member


class EnumLowerBase(str, Enum):
    @classmethod
    def _missing_(cls, value):
        for member in cls:
            if member.value == value.lower():
                return member


class EntityStatusType(EnumUpperBase):
    ACTIVE = 'ACTIVE'
    DELETED = 'DELETED'


class EntityStatusUpdate(BaseModel):
    status: EntityStatusType
