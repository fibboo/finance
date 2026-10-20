from starlette import status

from app.configs.logging_settings import get_logger, LogLevelType
from app.exceptions.conflict_409 import ConflictException
from app.exceptions.temporary_redirect_307 import ClientRedirect
from app.schemas.error_response import ErrorCodeType

logger = get_logger(logger_name=__name__)


def test_client_redirect_carries_the_original_log_entry():
    # Arrange
    exception = ConflictException(
        message="The identity is linked to another user",
        log_message="external_users integrity error on uq_external_users_provider_external_id",
        error_code=ErrorCodeType.IDENTITY_LINKED_TO_ANOTHER_USER,
        logger=logger,
        log_level=LogLevelType.ERROR,
    )

    # Act
    client_redirect = ClientRedirect(url="https://finance.test/auth/callback?error=server_error", exception=exception)

    # Assert
    assert client_redirect.status_code == status.HTTP_307_TEMPORARY_REDIRECT
    assert client_redirect.url == "https://finance.test/auth/callback?error=server_error"
    assert client_redirect.log_message == exception.log_message
    assert client_redirect.log_level == LogLevelType.ERROR
    assert client_redirect.logger is logger
