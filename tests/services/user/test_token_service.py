import hashlib
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from joserfc import jwt
from joserfc.jwk import OctKey
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import settings
from app.crud.user.refresh_token import refresh_token_crud
from app.crud.user.user import user_crud
from app.exceptions.unauthorized_401 import (
    InvalidRefreshTokenException,
    InvalidTokenException,
    RefreshTokenExpiredException,
    RefreshTokenReusedException,
    TokenExpiredException,
)
from app.models.user.refresh_token import RefreshToken as RefreshTokenModel
from app.models.user.user import User as UserModel
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.token import TokenPair
from app.schemas.user.user import UserCreate
from app.services.user import token_service


async def test_issue_token_pair(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD")
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)

    # Act
    token: TokenPair = await token_service.issue_token_pair(db=db_transaction, user_id=user_db.id)
    await db_transaction.commit()

    # Assert
    assert token.expires_in == settings.access_token_expire_seconds

    claims: dict = jwt.decode(token.access_token, OctKey.import_key(settings.jwt_secret), algorithms=["HS256"]).claims
    assert claims["sub"] == str(user_db.id)
    assert claims["exp"] - claims["iat"] == settings.access_token_expire_seconds
    assert claims["jti"] is not None

    # only the hash of the refresh token is stored
    refresh_tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db, user_id=user_db.id)
    assert len(refresh_tokens_db) == 1
    assert refresh_tokens_db[0].token_hash == hashlib.sha256(token.refresh_token.encode("utf-8")).hexdigest()
    assert refresh_tokens_db[0].revoked is False


async def test_verify_access_token_ok():
    # Arrange
    user_id: UUID = uuid4()
    access_token: str = jwt.encode(
        {"alg": "HS256"}, {"sub": str(user_id), "exp": 4102444800}, OctKey.import_key(settings.jwt_secret)
    )

    # Act
    result: UUID = token_service.verify_access_token(access_token=access_token)

    # Assert
    assert result == user_id


async def test_verify_access_token_expired():
    # Arrange
    access_token: str = jwt.encode(
        {"alg": "HS256"}, {"sub": str(uuid4()), "exp": 946684800}, OctKey.import_key(settings.jwt_secret)
    )

    # Act / Assert
    with pytest.raises(TokenExpiredException) as exc:
        token_service.verify_access_token(access_token=access_token)

    assert exc.value.error_code == ErrorCodeType.TOKEN_EXPIRED


@pytest.mark.parametrize(
    "secret, claims",
    [
        ("another_secret_of_at_least_32_bytes", {"sub": str(uuid4()), "exp": 4102444800}),
        (settings.jwt_secret, {"exp": 4102444800}),
        (settings.jwt_secret, {"sub": str(uuid4())}),
        (settings.jwt_secret, {"sub": "not-a-user-id", "exp": 4102444800}),
    ],
    ids=["wrong_signature", "missing_sub", "missing_exp", "sub_not_uuid"],
)
async def test_verify_access_token_invalid(secret: str, claims: dict):
    # Arrange
    access_token: str = jwt.encode({"alg": "HS256"}, claims, OctKey.import_key(secret))

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        token_service.verify_access_token(access_token=access_token)

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN


async def test_verify_access_token_malformed():
    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        token_service.verify_access_token(access_token="not-a-jwt")

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN


async def test_rotate_refresh_token_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD")
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    family_id: UUID = uuid4()
    old_token_db: RefreshTokenModel = await refresh_token_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "token_hash": hashlib.sha256(b"old_refresh_token").hexdigest(),
            "family_id": family_id,
            "expires_at": datetime.now() + timedelta(days=1),
        },
        commit=True,
    )

    # Act
    token: TokenPair = await token_service.rotate_refresh_token(db=db_transaction, refresh_token="old_refresh_token")
    await db_transaction.commit()

    # Assert
    await db.refresh(old_token_db)
    assert old_token_db.revoked is True

    new_token_hash: str = hashlib.sha256(token.refresh_token.encode("utf-8")).hexdigest()
    new_token_db: RefreshTokenModel = await refresh_token_crud.get(db=db, token_hash=new_token_hash)
    assert new_token_db.family_id == family_id
    assert new_token_db.user_id == user_db.id
    assert new_token_db.revoked is False

    claims: dict = jwt.decode(token.access_token, OctKey.import_key(settings.jwt_secret), algorithms=["HS256"]).claims
    assert claims["sub"] == str(user_db.id)


async def test_rotate_refresh_token_reused_revokes_family(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD")
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    family_id: UUID = uuid4()
    other_family_id: UUID = uuid4()
    # the reused token was already rotated into the active one; the other family is another sign-in
    await refresh_token_crud.create_batch(
        db=db,
        objs_in=[
            {
                "user_id": user_db.id,
                "token_hash": hashlib.sha256(b"reused_refresh_token").hexdigest(),
                "family_id": family_id,
                "expires_at": datetime.now() + timedelta(days=1),
                "revoked": True,
            },
            {
                "user_id": user_db.id,
                "token_hash": hashlib.sha256(b"active_refresh_token").hexdigest(),
                "family_id": family_id,
                "expires_at": datetime.now() + timedelta(days=1),
            },
            {
                "user_id": user_db.id,
                "token_hash": hashlib.sha256(b"other_refresh_token").hexdigest(),
                "family_id": other_family_id,
                "expires_at": datetime.now() + timedelta(days=1),
            },
        ],
        commit=True,
    )

    # Act / Assert
    with pytest.raises(RefreshTokenReusedException) as exc:
        await token_service.rotate_refresh_token(db=db_transaction, refresh_token="reused_refresh_token")
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN

    db.expire_all()
    family_tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db, family_id=family_id)
    assert len(family_tokens_db) == 2
    assert all(token_db.revoked for token_db in family_tokens_db)

    other_token_db: RefreshTokenModel = await refresh_token_crud.get(db=db, family_id=other_family_id)
    assert other_token_db.revoked is False


async def test_rotate_refresh_token_unknown(db: AsyncSession, db_transaction: AsyncSession):
    # Act / Assert
    with pytest.raises(InvalidRefreshTokenException) as exc:
        await token_service.rotate_refresh_token(db=db_transaction, refresh_token="unknown_refresh_token")
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN

    tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db)
    assert len(tokens_db) == 0


async def test_rotate_refresh_token_expired(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD")
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    expired_token_db: RefreshTokenModel = await refresh_token_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "token_hash": hashlib.sha256(b"expired_refresh_token").hexdigest(),
            "family_id": uuid4(),
            "expires_at": datetime.now() - timedelta(seconds=1),
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(RefreshTokenExpiredException) as exc:
        await token_service.rotate_refresh_token(db=db_transaction, refresh_token="expired_refresh_token")
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.TOKEN_EXPIRED

    tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db, user_id=user_db.id)
    assert len(tokens_db) == 1
    assert tokens_db[0].id == expired_token_db.id


async def test_revoke_refresh_token_revokes_family(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD")
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    family_id: UUID = uuid4()
    other_family_id: UUID = uuid4()
    await refresh_token_crud.create_batch(
        db=db,
        objs_in=[
            {
                "user_id": user_db.id,
                "token_hash": hashlib.sha256(b"rotated_refresh_token").hexdigest(),
                "family_id": family_id,
                "expires_at": datetime.now() + timedelta(days=1),
                "revoked": True,
            },
            {
                "user_id": user_db.id,
                "token_hash": hashlib.sha256(b"active_refresh_token").hexdigest(),
                "family_id": family_id,
                "expires_at": datetime.now() + timedelta(days=1),
            },
            {
                "user_id": user_db.id,
                "token_hash": hashlib.sha256(b"other_refresh_token").hexdigest(),
                "family_id": other_family_id,
                "expires_at": datetime.now() + timedelta(days=1),
            },
        ],
        commit=True,
    )

    # Act
    await token_service.revoke_refresh_token(db=db_transaction, refresh_token="active_refresh_token")
    await db_transaction.commit()

    # Assert
    db.expire_all()
    family_tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db, family_id=family_id)
    assert len(family_tokens_db) == 2
    assert all(token_db.revoked for token_db in family_tokens_db)

    other_token_db: RefreshTokenModel = await refresh_token_crud.get(db=db, family_id=other_family_id)
    assert other_token_db.revoked is False


async def test_revoke_refresh_token_unknown(db: AsyncSession, db_transaction: AsyncSession):
    # Act
    await token_service.revoke_refresh_token(db=db_transaction, refresh_token="unknown_refresh_token")
    await db_transaction.commit()

    # Assert
    tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db)
    assert len(tokens_db) == 0


async def test_revoke_refresh_token_no_cookie(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_create = UserCreate(username="test", registration_provider=ProviderType.TELEGRAM, base_currency="USD")
    user_db: UserModel = await user_crud.create(db=db, obj_in=user_create, commit=True)
    await refresh_token_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "token_hash": hashlib.sha256(b"active_refresh_token").hexdigest(),
            "family_id": uuid4(),
            "expires_at": datetime.now() + timedelta(days=1),
        },
        commit=True,
    )

    # Act
    await token_service.revoke_refresh_token(db=db_transaction, refresh_token=None)
    await db_transaction.commit()

    # Assert
    tokens_db: list[RefreshTokenModel] = await refresh_token_crud.get_batch(db=db, user_id=user_db.id)
    assert len(tokens_db) == 1
    assert tokens_db[0].revoked is False
