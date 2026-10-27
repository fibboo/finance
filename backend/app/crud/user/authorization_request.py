from uuid import UUID

from sqlalchemy import delete, Delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user.authorization_request import AuthorizationRequest
from app.schemas.user.authorization_request import AuthorizationRequestCreate, AuthorizationRequestUpdate


class CRUDAuthorizationRequest(CRUDBase[AuthorizationRequest, AuthorizationRequestCreate, AuthorizationRequestUpdate]):
    async def get_by_state(self, *, db: AsyncSession, state: str) -> AuthorizationRequest | None:
        authorization_request: AuthorizationRequest | None = await self.get_or_none(
            db=db, with_for_update=True, state=state
        )
        return authorization_request

    async def get_by_code_hash(self, *, db: AsyncSession, code_hash: str) -> AuthorizationRequest | None:
        authorization_request: AuthorizationRequest | None = await self.get_or_none(
            db=db, with_for_update=True, code_hash=code_hash
        )
        return authorization_request

    async def get_by_merge_code_hash(
        self, *, db: AsyncSession, merge_code_hash: str, with_for_update: bool
    ) -> AuthorizationRequest | None:
        authorization_request: AuthorizationRequest | None = await self.get_or_none(
            db=db, with_for_update=with_for_update, merge_code_hash=merge_code_hash
        )
        return authorization_request

    async def delete_by_user(self, *, db: AsyncSession, user_id: UUID) -> None:
        query: Delete = delete(self.model).where(
            or_(self.model.user_id == user_id, self.model.link_user_id == user_id, self.model.merge_user_id == user_id)
        )
        await db.execute(query)
        await db.flush()


authorization_request_crud = CRUDAuthorizationRequest(model=AuthorizationRequest)
