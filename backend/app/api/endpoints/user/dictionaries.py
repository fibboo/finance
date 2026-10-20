from fastapi import APIRouter, Depends

from app.api.deps import get_user_id
from app.schemas.user.dictionary import UserDictionaries
from app.services.user import dictionary_service

router = APIRouter()


@router.get("", dependencies=[Depends(get_user_id)])
async def get_user_dictionaries() -> UserDictionaries:
    """The value sets of the user domain, each item a key and a label."""
    dictionaries: UserDictionaries = dictionary_service.get_user_dictionaries()
    return dictionaries
