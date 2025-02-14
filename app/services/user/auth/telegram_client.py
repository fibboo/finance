import base64
import hashlib
import hmac
from collections import OrderedDict
from datetime import datetime
from urllib import parse

from app.configs.logging_settings import get_logger
from app.configs.settings import base_settings, telegram_settings
from app.exceptions.unauthorized_401 import InvalidAuthData
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import AuthUser, SessionAuth
from app.services.user.auth.auth_client import AuthClient

logger = get_logger(__name__)


class AuthTelegramClient(AuthClient):
    @property
    def provider(self) -> ProviderType:
        return ProviderType.TELEGRAM

    @property
    def auth_link(self) -> str:
        return telegram_settings.client_id

    @staticmethod
    def _check_telegram_authorization(auth_data: dict[str, str]) -> bool:
        auth_data = auth_data.copy()
        telegram_hash = auth_data['hash']

        del auth_data['hash']

        auth_data_ordered = OrderedDict(sorted(auth_data.items()))
        key_values: list[str] = [f'{k}={v}' for k, v in auth_data_ordered.items()]
        key_values_joined = '\n'.join(key_values)

        hash_secret = hashlib.sha256(telegram_settings.token.encode('utf-8')).digest()

        sign = hmac.new(hash_secret, key_values_joined.encode('utf-8'), hashlib.sha256).hexdigest()

        return telegram_hash == sign

    def get_session_auth(self, auth_code: str) -> tuple[SessionAuth, AuthUser]:
        decoded_token = base64.b64decode(auth_code).decode('utf-8')

        parse_result: dict = parse.parse_qs(parse.urlsplit(decoded_token).query)
        parse_result: dict[str, str] = {str(k): str(v[0]) for k, v in parse_result.items()}

        try:
            telegram_id = str(parse_result['id'])
            username = str(parse_result.get('username', f'user from Telegram {str(datetime.now().timestamp())[-6:]}'))
            telegram_hash = str(parse_result['hash'])

        except Exception:
            raise InvalidAuthData('Invalid telegram code in request.', logger=logger)

        if not self._check_telegram_authorization(auth_data=parse_result):
            raise InvalidAuthData('Error while checking sign information from telegram', logger=logger)

        session_auth = SessionAuth(access_token=telegram_hash,
                                   token_type='telegramHash',
                                   expires_in=base_settings.session_expire_seconds,
                                   scope='write-message+auth',
                                   user_identifier=telegram_id)

        auth_user = AuthUser(external_id=telegram_id,
                             username=username,
                             provider=self.provider,
                             is_notify=True)

        return session_auth, auth_user
