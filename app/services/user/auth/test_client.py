import base64
from datetime import datetime

from app.configs.logging_settings import get_logger
from app.configs.settings import EnvironmentType, settings
from app.exceptions.forbidden_403 import EnvironmentMismatch
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import AuthUser, SessionAuth
from app.services.user.auth.auth_client import AuthClient

logger = get_logger(__name__)


class AuthTestClient(AuthClient):
    @property
    def provider(self) -> ProviderType:
        if settings.environment != EnvironmentType.LOCAL:
            raise EnvironmentMismatch(required_env=EnvironmentType.LOCAL, logger=logger)

        return ProviderType.TEST

    @property
    def auth_link(self) -> str:
        if settings.environment != EnvironmentType.LOCAL:
            raise EnvironmentMismatch(required_env=EnvironmentType.LOCAL, logger=logger)

        return 'test'

    def get_session_auth(self, auth_code: str) -> tuple[SessionAuth, AuthUser]:
        if settings.environment != EnvironmentType.DEV:
            raise EnvironmentMismatch(required_env=EnvironmentType.DEV, logger=logger)

        user_identifier = base64.b64encode(auth_code.encode()).decode('utf-8')
        username = f'Test user {str(datetime.now().timestamp())[-6:]}'

        session_auth = SessionAuth(access_token=str(hash(auth_code)),
                                   token_type='test_hash',
                                   expires_in=settings.session_expire_seconds,
                                   scope='test_scope',
                                   user_identifier=user_identifier)

        auth_user = AuthUser(external_id=user_identifier,
                             username=username,
                             provider=self.provider)

        return session_auth, auth_user
