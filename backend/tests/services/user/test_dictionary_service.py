from app.schemas.dictionary import DictionaryItem
from app.schemas.user.dictionary import UserDictionaries
from app.services.user import dictionary_service


def test_get_user_dictionaries():
    # Act
    dictionaries: UserDictionaries = dictionary_service.get_user_dictionaries()

    # Assert
    assert dictionaries.provider_types == [
        DictionaryItem(key="TELEGRAM", label="Telegram"),
        DictionaryItem(key="GOOGLE", label="Google"),
    ]
