from app.schemas.accounting.dictionary import DictionaryItem
from app.schemas.user.dictionary import UserDictionaries
from app.schemas.user.external_user import PROVIDER_TYPE_LABELS, ProviderType


def get_user_dictionaries() -> UserDictionaries:
    provider_types: list[DictionaryItem] = []
    for provider_type in ProviderType:
        provider_types.append(DictionaryItem(key=provider_type.value, label=PROVIDER_TYPE_LABELS[provider_type]))

    dictionaries = UserDictionaries(provider_types=provider_types)
    return dictionaries
