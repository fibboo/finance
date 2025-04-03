from abc import ABC, abstractmethod
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.user.session import user_session_crud
from app.crud.user.user import user_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.user.session import Session as SessionModel
from app.models.user.user import User as UserModel
from app.schemas.base import CurrencyType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import AuthData, Session
from app.schemas.user.user import User
from app.services.user import session_service, user_service

logger = get_logger(__name__)


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
    def get_session_auth(self, auth_code: str) -> AuthData:
        pass

    async def _get_token(self, *, db: AsyncSession, user_db: UserModel, auth_data: AuthData) -> UUID:
        user: User = User.model_validate(user_db)
        user_session: SessionModel | None = await user_session_crud.get_active_session(db=db,
                                                                                       user_id=user.id)
        if user_session is None:
            user_session: Session = await session_service.create_session(db=db,
                                                                         user_id=user.id,
                                                                         provider=self.provider,
                                                                         auth_data=auth_data)
        return user_session.id

    async def login(self, *, db: AsyncSession, auth_code: str) -> UUID:
        auth_data: AuthData = self.get_session_auth(auth_code=auth_code)
        user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                            external_id=auth_data.external_id,
                                                                            provider=self.provider)
        if user_db is None:
            raise EntityNotFound(entity=UserModel,
                                 search_params={'external_id': auth_data.external_id, 'provider': self.provider.value},
                                 logger=logger)

        token: UUID = await self._get_token(db=db, user_db=user_db, auth_data=auth_data)
        return token

    async def register(self, *, db: AsyncSession, auth_code: str, base_currency: CurrencyType) -> UUID:
        auth_data: AuthData = self.get_session_auth(auth_code=auth_code)
        user_db: UserModel | None = await user_crud.get_user_by_external_id(db=db,
                                                                            external_id=auth_data.external_id,
                                                                            provider=self.provider)
        if user_db is None:
            user_db: UserModel = await user_service.create_user(db=db, auth_data=auth_data, base_currency=base_currency)

        token: UUID = await self._get_token(db=db, user_db=user_db, auth_data=auth_data)
        return token
