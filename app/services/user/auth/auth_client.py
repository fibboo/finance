from abc import abstractmethod, ABC
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user.external_user import external_user_crud
from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.exceptions.exception import IntegrityExistException
from app.models import UserSession, User as UserModel, ExternalUser as ExternalUserModel
from app.schemas.user.external_user import ProviderType, ExternalUserCreate
from app.schemas.user.session import SessionAuth, AuthUser
from app.schemas.user.user import User, UserCreate
from app.services.user import session_service


class AuthClient(ABC):
    @property
    @abstractmethod
    def provider(self) -> ProviderType:
        pass

    @property
    @abstractmethod
    def auth_link(self) -> str:
        pass

    @abstractmethod
    def get_session_auth(self, auth_code: str) -> tuple[SessionAuth, AuthUser]:
        pass

    async def _create_user(self, db: AsyncSession, auth_user: AuthUser) -> UserModel:
        user_create = UserCreate(username=auth_user.username,
                                 avatar=auth_user.avatar,
                                 registration_provider=self.provider)

        try:
            user_db: UserModel = await user_crud.create(db=db, obj_in=user_create)
        except IntegrityError as exc:
            raise IntegrityExistException(model=UserModel, exception=exc)

        external_user_create = ExternalUserCreate(user_id=user_db.id,
                                                  provider=self.provider,
                                                  external_id=auth_user.external_id,
                                                  username=auth_user.username,
                                                  first_name=auth_user.first_name,
                                                  last_name=auth_user.last_name,
                                                  avatar=auth_user.avatar,
                                                  profile_url=auth_user.profile_url,
                                                  email=auth_user.email)
        external_user_db: ExternalUserModel = await external_user_crud.create(db=db, obj_in=external_user_create)
        user_db.external_users = [external_user_db]
        return user_db

    async def get_token(self, db: AsyncSession, auth_code: str) -> UUID:
        session_auth, auth_user = self.get_session_auth(auth_code=auth_code)
        user_db: Optional[UserModel] = await user_crud.get_user_by_external_id(db=db,
                                                                               external_id=auth_user.external_id,
                                                                               provider=self.provider)
        if user_db is None:
            user_db: UserModel = await self._create_user(db=db, auth_user=auth_user)

        user: User = User.model_validate(user_db)
        user_session: Optional[UserSession] = await user_session_crud.get_active_session(db=db,
                                                                                         user_id=user.id,
                                                                                         date=datetime.now())
        if user_session is None:
            user_session: UserSession = await session_service.create_session(db=db,
                                                                             user_id=user.id,
                                                                             provider=self.provider,
                                                                             session_auth=session_auth)
        return user_session.id
