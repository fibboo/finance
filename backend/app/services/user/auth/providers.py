from app.configs.settings import google_settings, telegram_settings
from app.schemas.user.external_user import ProviderType
from app.services.user.auth.oidc_provider import OIDCProvider

providers: dict[ProviderType, OIDCProvider] = {
    ProviderType.TELEGRAM: OIDCProvider(
        provider=ProviderType.TELEGRAM,
        client_id=telegram_settings.client_id,
        client_secret=telegram_settings.client_secret,
        server_metadata_url=telegram_settings.server_metadata_url,
        scope="openid profile",
    ),
    ProviderType.GOOGLE: OIDCProvider(
        provider=ProviderType.GOOGLE,
        client_id=google_settings.client_id,
        client_secret=google_settings.client_secret,
        server_metadata_url=google_settings.server_metadata_url,
        scope="openid profile email",
        issuer_aliases=("accounts.google.com",),
    ),
}
