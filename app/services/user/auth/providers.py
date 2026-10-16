from app.configs.settings import telegram_settings
from app.schemas.user.external_user import ProviderType
from app.services.user.auth.oidc_provider import OIDCProvider

providers: dict[ProviderType, OIDCProvider] = {
    ProviderType.TELEGRAM: OIDCProvider(
        provider=ProviderType.TELEGRAM,
        client_id=telegram_settings.client_id,
        client_secret=telegram_settings.client_secret,
        server_metadata_url="https://oauth.telegram.org/.well-known/openid-configuration",
        scope="openid profile",
    ),
}
