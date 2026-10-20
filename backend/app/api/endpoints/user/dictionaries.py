from fastapi import APIRouter

from app.schemas.user.dictionary import UserDictionaries
from app.services.user import dictionary_service

router = APIRouter()


@router.get("")
async def get_user_dictionaries() -> UserDictionaries:
    """The value sets of the user domain, each item a key and a label, served without sign-in."""
    dictionaries: UserDictionaries = dictionary_service.get_user_dictionaries()
    return dictionaries
