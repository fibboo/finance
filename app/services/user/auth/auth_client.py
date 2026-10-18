from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.user.user import user_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.user.user import User as UserModel
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import AuthData
from app.schemas.user.token import TokenResponse
from app.services.user import token_service, user_service

logger = get_logger(logger_name=__name__)


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
    def get_session_auth(self, *, auth_code: str) -> AuthData:
        pass

    async def login(self, *, db: AsyncSession, auth_code: str) -> TokenResponse:
        auth_data: AuthData = self.get_session_auth(auth_code=auth_code)
        user_db: UserModel | None = await user_crud.get_user_by_external_id(
            db=db, external_id=auth_data.external_id, provider=self.provider
        )
        if user_db is None:
            raise EntityNotFound(
                entity=UserModel,
                search_params={"external_id": auth_data.external_id, "provider": self.provider.value},
                logger=logger,
            )

        token: TokenResponse = await token_service.issue_token_pair(db=db, user_id=user_db.id)
        return token

    async def register(self, *, db: AsyncSession, auth_code: str) -> TokenResponse:
        auth_data: AuthData = self.get_session_auth(auth_code=auth_code)
        user_db: UserModel | None = await user_crud.get_user_by_external_id(
            db=db, external_id=auth_data.external_id, provider=self.provider
        )
        if user_db is None:
            user_db: UserModel = await user_service.create_user(db=db, auth_data=auth_data)

        token: TokenResponse = await token_service.issue_token_pair(db=db, user_id=user_db.id)
        return token
