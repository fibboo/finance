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

    async def get_by_merge_code_hash(self, *, db: AsyncSession, merge_code_hash: str) -> AuthorizationRequest | None:
        authorization_request: AuthorizationRequest | None = await self.get_or_none(
            db=db, with_for_update=True, merge_code_hash=merge_code_hash
        )
        return authorization_request


authorization_request_crud = CRUDAuthorizationRequest(model=AuthorizationRequest)
