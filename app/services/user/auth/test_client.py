import base64
from datetime import datetime

from app.config.settings import settings, EnvironmentType
from app.exceptions.exception import UnauthorizedException
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import SessionAuth, AuthUser
from app.services.user.auth.auth_client import AuthClient


class AuthTestClient(AuthClient):
    @property
    def provider(self) -> ProviderType:
        if settings.environment != EnvironmentType.DEV:
            raise UnauthorizedException(f'Test client requires environment {EnvironmentType.DEV}')

        return ProviderType.TEST

    @property
    def auth_link(self) -> str:
        if settings.environment != EnvironmentType.DEV:
            raise UnauthorizedException(f'Test client requires environment {EnvironmentType.DEV}')

        return 'test'

    def get_session_auth(self, auth_code: str) -> tuple[SessionAuth, AuthUser]:
        if settings.environment != EnvironmentType.DEV:
            raise UnauthorizedException(f'Test client requires environment {EnvironmentType.DEV}')

        user_identifier = base64.b64encode(auth_code.encode()).decode('utf-8')
        username = f'Test user {str(datetime.now().timestamp())[-6:]}'

        session_auth = SessionAuth(access_token=str(hash(auth_code)),
                                   token_type='test_hash',
                                   expires_in=settings.session_expire_seconds,
                                   scope='test_scope',
                                   user_identifier=user_identifier)

        auth_user = AuthUser(external_id=user_identifier,
                             username=username,
                             provider=self.provider,
                             is_notify=True)

        return session_auth, auth_user
