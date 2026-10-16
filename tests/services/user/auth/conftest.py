import pytest
from joserfc.jwk import ECKey
from pytest_httpx import HTTPXMock


@pytest.fixture
def telegram_signing_key(httpx_mock: HTTPXMock) -> ECKey:
    signing_key: ECKey = ECKey.generate_key("P-256", parameters={"kid": "telegram-test-key", "alg": "ES256"})
    httpx_mock.add_response(
        method="GET",
        url="https://oauth.telegram.org/.well-known/openid-configuration",
        json={
            "issuer": "https://oauth.telegram.org",
            "authorization_endpoint": "https://oauth.telegram.org/auth",
            "token_endpoint": "https://oauth.telegram.org/token",
            "jwks_uri": "https://oauth.telegram.org/.well-known/jwks.json",
            "id_token_signing_alg_values_supported": ["RS256", "ES256"],
        },
        is_reusable=True,
    )
    httpx_mock.add_response(
        method="GET",
        url="https://oauth.telegram.org/.well-known/jwks.json",
        json={"keys": [signing_key.as_dict(private=False)]},
        is_optional=True,
        is_reusable=True,
    )
    return signing_key
