import secrets
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from joserfc import jwt
from joserfc.errors import ExpiredTokenError, JoseError
from joserfc.jwk import OctKey
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.configs.settings import settings
from app.crud.user.refresh_token import refresh_token_crud
from app.exceptions.unauthorized_401 import InvalidTokenException, RefreshTokenReusedException, TokenExpiredException
from app.models.user.refresh_token import RefreshToken as RefreshTokenModel
from app.schemas.user.token import RefreshTokenCreate, TokenResponse
from app.utils.utils import hash_secret

logger = get_logger(logger_name=__name__)

JWT_ALGORITHM = "HS256"


def _encode_access_token(*, user_id: UUID, issued_at: int) -> str:
    claims: dict[str, str | int] = {
        "sub": str(user_id),
        "iat": issued_at,
        "exp": issued_at + settings.access_token_expire_seconds,
        "jti": str(uuid4()),
    }
    access_token: str = jwt.encode({"alg": JWT_ALGORITHM}, claims, OctKey.import_key(settings.jwt_secret))
    return access_token


async def issue_token_pair(*, db: AsyncSession, user_id: UUID, family_id: UUID | None = None) -> TokenResponse:
    now: datetime = datetime.now()
    refresh_token: str = secrets.token_urlsafe(48)
    refresh_token_create = RefreshTokenCreate(
        user_id=user_id,
        token_hash=hash_secret(secret=refresh_token),
        family_id=family_id if family_id is not None else uuid4(),
        expires_at=now + timedelta(seconds=settings.refresh_token_expire_seconds),
    )
    await refresh_token_crud.create(db=db, obj_in=refresh_token_create)

    token = TokenResponse(
        access_token=_encode_access_token(user_id=user_id, issued_at=int(now.timestamp())),
        token_type="Bearer",
        expires_in=settings.access_token_expire_seconds,
        refresh_token=refresh_token,
    )
    return token


def verify_access_token(*, access_token: str) -> UUID:
    try:
        token: jwt.Token = jwt.decode(access_token, OctKey.import_key(settings.jwt_secret), algorithms=[JWT_ALGORITHM])
        jwt.JWTClaimsRegistry(sub={"essential": True}, exp={"essential": True}).validate(token.claims)
        user_id = UUID(token.claims["sub"])

    except ExpiredTokenError:
        raise TokenExpiredException(log_message="Access token expired", logger=logger)

    except JoseError as exc:
        raise InvalidTokenException(log_message=f"Access token rejected: {exc.error}", logger=logger)

    except ValueError:
        raise InvalidTokenException(log_message="Access token subject is not a user id", logger=logger)

    return user_id


async def rotate_refresh_token(*, db: AsyncSession, refresh_token: str) -> TokenResponse:
    token_hash: str = hash_secret(secret=refresh_token)
    refresh_token_db: RefreshTokenModel | None = await refresh_token_crud.get_by_hash(db=db, token_hash=token_hash)
    if refresh_token_db is None:
        raise InvalidTokenException(log_message="Unknown refresh token", logger=logger)

    if refresh_token_db.revoked:
        await refresh_token_crud.update_orm(db=db, family_id=refresh_token_db.family_id, obj_in={"revoked": True})
        raise RefreshTokenReusedException(family_id=refresh_token_db.family_id, logger=logger)

    if refresh_token_db.expires_at <= datetime.now():
        raise TokenExpiredException(log_message=f"Refresh token `{refresh_token_db.id}` expired", logger=logger)

    await refresh_token_crud.update_orm(db=db, id=refresh_token_db.id, obj_in={"revoked": True})

    token: TokenResponse = await issue_token_pair(
        db=db, user_id=refresh_token_db.user_id, family_id=refresh_token_db.family_id
    )
    return token


async def revoke_refresh_token(*, db: AsyncSession, refresh_token: str) -> None:
    token_hash: str = hash_secret(secret=refresh_token)
    refresh_token_db: RefreshTokenModel | None = await refresh_token_crud.get_by_hash(db=db, token_hash=token_hash)
    if refresh_token_db is None:
        return

    await refresh_token_crud.update_orm(db=db, family_id=refresh_token_db.family_id, obj_in={"revoked": True})
