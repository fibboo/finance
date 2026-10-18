from app.crud.base import CRUDBase
from app.models.accounting.account import Account
from app.schemas.accounting.account import AccountCreate, AccountUpdate


class CRUDAccount(CRUDBase[Account, AccountCreate, AccountUpdate]):
    pass


account_crud = CRUDAccount(model=Account)
