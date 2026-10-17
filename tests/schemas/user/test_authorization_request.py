import pytest
from pydantic import ValidationError

from app.schemas.user.authorization_request import AuthorizeRequest


def test_authorize_request_ok():
    # Act
    authorize_request = AuthorizeRequest(
        redirect_uri="https://finance.test/auth/callback",
        code_challenge="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method="S256",
        state="client_state",
    )

    # Assert
    assert authorize_request.code_challenge == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    assert authorize_request.state == "client_state"


@pytest.mark.parametrize(
    "code_challenge, code_challenge_method, state",
    [
        ("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-c", "S256", "client_state"),
        ("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cMM", "S256", "client_state"),
        ("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM", "S256", "client_state"),
        ("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "plain", "client_state"),
        ("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "S256", ""),
        ("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "S256", "s" * 513),
    ],
    ids=[
        "challenge_too_short",
        "challenge_too_long",
        "challenge_not_base64url",
        "plain_method",
        "empty_state",
        "state_too_long",
    ],
)
def test_authorize_request_invalid(code_challenge: str, code_challenge_method: str, state: str):
    # Act / Assert
    with pytest.raises(ValidationError):
        AuthorizeRequest(
            redirect_uri="https://finance.test/auth/callback",
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            state=state,
        )
