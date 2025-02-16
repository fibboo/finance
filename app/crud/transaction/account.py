from app.crud.base import CRUDBase
from app.models import Account
from app.schemas.transaction.account import AccountCreate, AccountUpdate


class CRUDAccount(CRUDBase[Account, AccountCreate, AccountUpdate]):
    pass


account_crud = CRUDAccount(Account)
