from app.crud.base import CRUDBase
from app.models import ExternalUser
from app.schemas.user.external_user import ExternalUserCreate, ExternalUserUpdate


class CRUDExternalUser(CRUDBase[ExternalUser, ExternalUserCreate, ExternalUserUpdate]):
    pass


external_user_crud = CRUDExternalUser(ExternalUser)
