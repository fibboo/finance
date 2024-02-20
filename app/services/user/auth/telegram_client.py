import base64
import hashlib
import hmac
from collections import OrderedDict
from datetime import datetime
from urllib import parse

from app.config.settings import settings
from app.exceptions.exception import UnauthorizedException
from app.schemas.user.external_user import ProviderType
from app.schemas.user.session import SessionAuth, AuthUser
from app.services.user.auth.auth_client import AuthClient


class AuthTelegramClient(AuthClient):
    @property
    def provider(self) -> ProviderType:
        return ProviderType.TELEGRAM

    @property
    def auth_link(self) -> str:
        return settings.telegram_client_id

    def get_session_auth(self, auth_code: str) -> tuple[SessionAuth, AuthUser]:
        decoded_token = base64.b64decode(auth_code).decode('utf-8')

        parse_result: dict = parse.parse_qs(parse.urlsplit(decoded_token).query)
        parse_result: dict[str, str] = {str(k): str(v[0]) for k, v in parse_result.items()}

        try:
            telegram_id = str(parse_result['id'])
            username = str(parse_result.get('username', f'user from Telegram {str(datetime.now().timestamp())[-6:]}'))
            telegram_hash = str(parse_result['hash'])

        except Exception:
            raise UnauthorizedException('Invalid telegram code in request.')

        if not self._check_telegram_authorization(auth_data=parse_result):
            raise UnauthorizedException('Error while checking sign information from telegram')

        session_auth = SessionAuth(access_token=telegram_hash,
                                   token_type='telegramHash',
                                   expires_in=settings.session_expire_seconds,
                                   scope='write-message+auth',
                                   user_identifier=telegram_id)

        auth_user = AuthUser(external_id=telegram_id,
                             username=username,
                             provider=self.provider,
                             is_notify=True)

        return session_auth, auth_user

    def _check_telegram_authorization(self, auth_data: dict[str, str]) -> bool:
        auth_data = auth_data.copy()
        telegram_hash = auth_data['hash']

        del auth_data['hash']

        auth_data_ordered = OrderedDict(sorted(auth_data.items()))
        key_values: list[str] = [f'{k}={v}' for k, v in auth_data_ordered.items()]
        key_values_joined = '\n'.join(key_values)

        hash_secret = hashlib.sha256(settings.telegram_token.encode("utf-8")).digest()

        sign = hmac.new(hash_secret, key_values_joined.encode("utf-8"), hashlib.sha256).hexdigest()

        return telegram_hash == sign
