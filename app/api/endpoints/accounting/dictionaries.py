from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_user_id
from app.schemas.accounting.dictionary import AccountingDictionaries
from app.services.accounting import dictionary_service

router = APIRouter()


@router.get("", dependencies=[Depends(get_user_id)])
async def get_accounting_dictionaries(*, db: AsyncSession = Depends(get_db)) -> AccountingDictionaries:
    """The value sets of the accounting domain, each item a key and a label."""
    dictionaries: AccountingDictionaries = await dictionary_service.get_accounting_dictionaries(db=db)
    return dictionaries
