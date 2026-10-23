from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.accounting.posting import Posting
from app.schemas.accounting.posting import PostingCreate


class CRUDPosting(CRUDBase[Posting, PostingCreate, PostingCreate]):
    async def update_amounts(self, *, db: AsyncSession, postings: list[dict[str, Any]]) -> None:
        await db.execute(update(self.model), postings)
        await db.flush()


posting_crud = CRUDPosting(model=Posting)
