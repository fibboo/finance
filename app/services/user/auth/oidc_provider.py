import httpx
from authlib.integrations.starlette_client import OAuth, OAuthError, StarletteOAuth2App
from joserfc.errors import JoseError

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.schemas.user.external_user import ProviderType
from app.schemas.user.identity import ProviderIdentity

logger = get_logger(logger_name=__name__)


class OIDCProvider:
    def __init__(
        self, *, provider: ProviderType, client_id: str, client_secret: str, server_metadata_url: str, scope: str
    ):
        self.provider = provider
        self.__client_id = client_id
        self.__client_secret = client_secret
        self.__server_metadata_url = server_metadata_url
        self.__scope = scope

    def __build_client(self) -> StarletteOAuth2App:
        client: StarletteOAuth2App = OAuth().register(
            name=self.provider.value,
            client_id=self.__client_id,
            client_secret=self.__client_secret,
            server_metadata_url=self.__server_metadata_url,
            client_kwargs={"scope": self.__scope, "code_challenge_method": "S256"},
        )
        return client

    @property
    def __callback_url(self) -> str:
        callback_url: str = f"{settings.public_base_url}/user/auth/callback/{self.provider.value}"
        return callback_url

    async def create_authorization_url(self, *, state: str, nonce: str, code_verifier: str) -> str:
        client: StarletteOAuth2App = self.__build_client()
        authorization: dict[str, str] = await client.create_authorization_url(
            redirect_uri=self.__callback_url, state=state, nonce=nonce, code_verifier=code_verifier
        )
        authorization_url: str = authorization["url"]
        return authorization_url

    async def fetch_identity(self, *, code: str, code_verifier: str, nonce: str) -> ProviderIdentity | None:
        client: StarletteOAuth2App = self.__build_client()

        try:
            token: dict = await client.fetch_access_token(
                redirect_uri=self.__callback_url, code=code, code_verifier=code_verifier
            )
            metadata: dict = await client.load_server_metadata()
            claims_options: dict[str, dict] = {
                "iss": {"essential": True, "value": metadata["issuer"]},
                "aud": {"essential": True, "value": self.__client_id},
            }
            claims: dict = await client.parse_id_token(token=token, nonce=nonce, claims_options=claims_options)

        except (OAuthError, JoseError, httpx.HTTPError) as exc:
            logger.warning(f"{self.provider.value} sign-in rejected: {type(exc).__name__} {exc}")
            return None

        identity = ProviderIdentity(
            provider=self.provider,
            subject=claims["sub"],
            username=claims.get("preferred_username"),
            first_name=claims.get("given_name"),
            last_name=claims.get("family_name"),
            avatar=claims.get("picture"),
            email=claims.get("email"),
        )
        return identity
