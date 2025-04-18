from enum import Enum

from pydantic import BaseModel
from starlette import status


class ErrorCodeType(str, Enum):
    ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND'
    INTEGRITY_ERROR = 'INTEGRITY_ERROR'

    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'

    SESSION_EXPIRED = 'SESSION_EXPIRED'
    INVALID_AUTH_DATA = 'INVALID_AUTH_DATA'

    ENVIRONMENT_MISMATCH = 'ENVIRONMENT_MISMATCH'
    MAX_ACCOUNTS_PER_USER = 'MAX_ACCOUNTS_PER_USER'
    ACCOUNT_UPDATE_FORBIDDEN = 'ACCOUNT_UPDATE_FORBIDDEN'
    ACCOUNT_DELETION_FORBIDDEN = 'ACCOUNT_DELETION_FORBIDDEN'
    NO_ACCOUNT_BASE_CURRENCY_RATE = 'NO_ACCOUNT_BASE_CURRENCY_RATE'
    CURRENCY_MISMATCH = 'CURRENCY_MISMATCH'
    ACCOUNT_TYPE_MISMATCH = 'ACCOUNT_TYPE_MISMATCH'


class ErrorResponse(BaseModel):
    message: str
    error_code: ErrorCodeType | None = None


responses = {
    status.HTTP_418_IM_A_TEAPOT: {
        'description': 'Custom errors with possible codes: 400, 401, 403, 404, 409, 501',
        'model': ErrorResponse
    }
}
