import hashlib
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.account import account_crud
from app.crud.accounting.location import location_crud
from app.crud.accounting.transaction import transaction_crud
from app.crud.user.authorization_request import authorization_request_crud
from app.crud.user.external_user import external_user_crud
from app.crud.user.refresh_token import refresh_token_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import BaseCurrencyMismatch, ProviderAlreadyLinked
from app.exceptions.unauthorized_401 import InvalidTokenException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.models.user.authorization_request import AuthorizationRequest as AuthorizationRequestModel
from app.models.user.refresh_token import RefreshToken as RefreshTokenModel
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountKind, CategoryType
from app.schemas.accounting.location import LocationCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import EntityStatusType
from app.schemas.error_response import ErrorCodeType
from app.schemas.user.external_user import ProviderType
from app.schemas.user.user import User, UserCreate
from app.services.user import merge_service


async def test_merge_ok(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "provider": ProviderType.TELEGRAM,
            "external_id": "1234123412341234123",
            "username": "johndoe",
        },
        commit=True,
    )
    other_user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.GOOGLE, base_currency="USD"),
        commit=True,
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": other_user_db.id,
            "provider": ProviderType.GOOGLE,
            "external_id": "110169484474386276334",
            "username": "janedoe",
        },
        commit=True,
    )
    accounts_db: list[AccountModel] = await account_crud.create_batch(
        db=db,
        objs_in=[
            {"user_id": user_db.id, "kind": AccountKind.ASSET, "name": "Wallet", "currency": "USD"},
            {
                "user_id": user_db.id,
                "kind": AccountKind.EXPENSE,
                "name": "Groceries",
                "category_type": CategoryType.VARIABLE,
            },
            {"user_id": user_db.id, "kind": AccountKind.EQUITY, "name": "Adjustments"},
            {"user_id": other_user_db.id, "kind": AccountKind.ASSET, "name": "Wallet", "currency": "USD"},
            {"user_id": other_user_db.id, "kind": AccountKind.ASSET, "name": "Wallet 2", "currency": "USD"},
            {
                "user_id": other_user_db.id,
                "kind": AccountKind.EXPENSE,
                "name": "Groceries",
                "category_type": CategoryType.FIXED,
            },
            {
                "user_id": other_user_db.id,
                "kind": AccountKind.EXPENSE,
                "name": "Travel",
                "category_type": CategoryType.PERIODIC,
            },
            {"user_id": other_user_db.id, "kind": AccountKind.EQUITY, "name": "Adjustments"},
            {
                "user_id": other_user_db.id,
                "kind": AccountKind.ASSET,
                "name": "Wallet",
                "currency": "USD",
                "status": EntityStatusType.DELETED,
            },
        ],
        commit=True,
    )
    wallet_db, groceries_db, adjustments_db = accounts_db[:3]
    other_wallet_db, other_wallet_2_db, other_groceries_db, travel_db, other_adjustments_db, deleted_wallet_db = (
        accounts_db[3:]
    )
    # the other wallet holds 10 USD left of an adjustment of 25 USD after an expense of 15 USD
    await account_crud.update_orm(
        db=db, obj_in={"balance": Decimal("10"), "base_balance": Decimal("10")}, id=other_wallet_db.id, commit=True
    )
    location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=user_db.id, name="Market"), commit=True
    )
    other_location_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=other_user_db.id, name="Market"), commit=True
    )
    shop_db: LocationModel = await location_crud.create(
        db=db, obj_in=LocationCreate(user_id=other_user_db.id, name="Shop"), commit=True
    )
    adjustment_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=other_user_db.id,
            transaction_type=TransactionType.ADJUSTMENT,
            transaction_date=date(2026, 10, 1),
            base_currency_amount=Decimal("25"),
        ),
        postings=[
            PostingCreate(
                account_id=other_adjustments_db.id, amount=Decimal("-25"), currency="USD", base_amount=Decimal("-25")
            ),
            PostingCreate(
                account_id=other_wallet_db.id, amount=Decimal("25"), currency="USD", base_amount=Decimal("25")
            ),
        ],
    )
    expense_db: TransactionModel = await transaction_crud.create_with_postings(
        db=db,
        obj_in=TransactionCreate(
            user_id=other_user_db.id,
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date(2026, 10, 2),
            base_currency_amount=Decimal("15"),
            location_id=other_location_db.id,
        ),
        postings=[
            PostingCreate(
                account_id=other_wallet_db.id, amount=Decimal("-15"), currency="USD", base_amount=Decimal("-15")
            ),
            PostingCreate(
                account_id=other_groceries_db.id, amount=Decimal("15"), currency="USD", base_amount=Decimal("15")
            ),
        ],
    )
    await db.commit()
    await refresh_token_crud.create(
        db=db,
        obj_in={
            "user_id": other_user_db.id,
            "token_hash": hashlib.sha256(b"refresh_token").hexdigest(),
            "family_id": uuid4(),
            "expires_at": datetime.now() + timedelta(days=1),
        },
        commit=True,
    )
    # a sign-in request of the other user, finished a minute ago
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "sign_in_state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now(),
            "user_id": other_user_db.id,
            "used": True,
        },
        commit=True,
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now(),
            "link_user_id": user_db.id,
            "used": True,
            "merge_user_id": other_user_db.id,
            "merge_code_hash": hashlib.sha256(b"merge_code").hexdigest(),
            "merge_expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )

    # Act
    user: User = await merge_service.merge(db=db_transaction, user_id=user_db.id, merge_code="merge_code")
    await db_transaction.commit()

    # Assert
    assert user.id == user_db.id
    assert user.username == "johndoe"
    assert user.base_currency == "USD"
    assert sorted(external_user.provider for external_user in user.external_users) == [
        ProviderType.GOOGLE,
        ProviderType.TELEGRAM,
    ]

    # the same-named money accounts get a free suffix, while the categories and Adjustments fold
    accounts_after_db: list[AccountModel] = (
        await db.scalars(
            select(AccountModel)
            .where(AccountModel.user_id == user_db.id)
            .order_by(AccountModel.id)
            .execution_options(populate_existing=True)
        )
    ).all()
    assert [(account_db.id, account_db.name, account_db.status) for account_db in accounts_after_db] == [
        (wallet_db.id, "Wallet", EntityStatusType.ACTIVE),
        (groceries_db.id, "Groceries", EntityStatusType.ACTIVE),
        (adjustments_db.id, "Adjustments", EntityStatusType.ACTIVE),
        (other_wallet_db.id, "Wallet 3", EntityStatusType.ACTIVE),
        (other_wallet_2_db.id, "Wallet 2", EntityStatusType.ACTIVE),
        (travel_db.id, "Travel", EntityStatusType.ACTIVE),
        (deleted_wallet_db.id, "Wallet", EntityStatusType.DELETED),
    ]
    assert accounts_after_db[1].category_type == CategoryType.VARIABLE
    other_wallet_after_db: AccountModel = accounts_after_db[3]
    assert other_wallet_after_db.balance == Decimal("10")
    assert other_wallet_after_db.base_balance == Decimal("10")

    folded_accounts_db: list[AccountModel] = (
        await db.scalars(
            select(AccountModel).where(AccountModel.id.in_([other_groceries_db.id, other_adjustments_db.id]))
        )
    ).all()
    assert folded_accounts_db == []

    locations_after_db: list[LocationModel] = (
        await db.scalars(
            select(LocationModel)
            .where(LocationModel.user_id == user_db.id)
            .order_by(LocationModel.id)
            .execution_options(populate_existing=True)
        )
    ).all()
    assert [location_after_db.id for location_after_db in locations_after_db] == [location_db.id, shop_db.id]

    transactions_after_db: list[TransactionModel] = (
        await db.scalars(
            select(TransactionModel)
            .where(TransactionModel.user_id == user_db.id)
            .order_by(TransactionModel.id)
            .execution_options(populate_existing=True)
        )
    ).all()
    assert [transaction_db.id for transaction_db in transactions_after_db] == [adjustment_db.id, expense_db.id]
    adjustment_after_db, expense_after_db = transactions_after_db
    assert [posting_db.account_id for posting_db in adjustment_after_db.postings] == [
        adjustments_db.id,
        other_wallet_db.id,
    ]
    assert [posting_db.account_id for posting_db in expense_after_db.postings] == [
        other_wallet_db.id,
        groceries_db.id,
    ]
    assert expense_after_db.location_id == location_db.id
    assert expense_after_db.base_currency_amount == Decimal("15")

    # the other user is gone with its tokens and requests
    other_user_after_db: UserModel | None = await db.scalar(select(UserModel).where(UserModel.id == other_user_db.id))
    assert other_user_after_db is None
    refresh_tokens_db: list[RefreshTokenModel] = (await db.scalars(select(RefreshTokenModel))).all()
    assert refresh_tokens_db == []
    requests_db: list[AuthorizationRequestModel] = (await db.scalars(select(AuthorizationRequestModel))).all()
    assert requests_db == []


async def test_merge_without_base_currency(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db, obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM), commit=True
    )
    other_user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.GOOGLE, base_currency="EUR"),
        commit=True,
    )
    other_wallet_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={"user_id": other_user_db.id, "kind": AccountKind.ASSET, "name": "Wallet", "currency": "EUR"},
        commit=True,
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now(),
            "link_user_id": user_db.id,
            "used": True,
            "merge_user_id": other_user_db.id,
            "merge_code_hash": hashlib.sha256(b"merge_code").hexdigest(),
            "merge_expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )

    # Act
    user: User = await merge_service.merge(db=db_transaction, user_id=user_db.id, merge_code="merge_code")
    await db_transaction.commit()

    # Assert
    assert user.base_currency == "EUR"

    await db.refresh(other_wallet_db)
    assert other_wallet_db.user_id == user_db.id
    assert other_wallet_db.name == "Wallet"


async def test_merge_long_name(db: AsyncSession, db_transaction: AsyncSession):
    # Arrange
    long_name: str = "W" * 64
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    other_user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.GOOGLE, base_currency="USD"),
        commit=True,
    )
    accounts_db: list[AccountModel] = await account_crud.create_batch(
        db=db,
        objs_in=[
            {"user_id": user_db.id, "kind": AccountKind.LIABILITY, "name": long_name, "currency": "USD"},
            {"user_id": other_user_db.id, "kind": AccountKind.LIABILITY, "name": long_name, "currency": "USD"},
        ],
        commit=True,
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now(),
            "link_user_id": user_db.id,
            "used": True,
            "merge_user_id": other_user_db.id,
            "merge_code_hash": hashlib.sha256(b"merge_code").hexdigest(),
            "merge_expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )

    # Act
    await merge_service.merge(db=db_transaction, user_id=user_db.id, merge_code="merge_code")
    await db_transaction.commit()

    # Assert
    other_account_db: AccountModel = accounts_db[1]
    await db.refresh(other_account_db)
    assert other_account_db.user_id == user_db.id
    assert other_account_db.name == f"{'W' * 62} 2"


@pytest.mark.parametrize(
    "base_currency, other_base_currency, other_provider, error_code",
    [
        ("USD", "EUR", ProviderType.GOOGLE, ErrorCodeType.BASE_CURRENCY_MISMATCH),
        ("USD", "USD", ProviderType.TELEGRAM, ErrorCodeType.PROVIDER_ALREADY_LINKED),
    ],
    ids=["base_currency_mismatch", "provider_conflict"],
)
async def test_merge_conflict(
    db: AsyncSession,
    db_transaction: AsyncSession,
    base_currency: str,
    other_base_currency: str,
    other_provider: ProviderType,
    error_code: ErrorCodeType,
):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM, base_currency=base_currency),
        commit=True,
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": user_db.id,
            "provider": ProviderType.TELEGRAM,
            "external_id": "1234123412341234123",
            "username": "johndoe",
        },
        commit=True,
    )
    other_user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="janedoe", registration_provider=other_provider, base_currency=other_base_currency),
        commit=True,
    )
    await external_user_crud.create(
        db=db,
        obj_in={
            "user_id": other_user_db.id,
            "provider": other_provider,
            "external_id": "110169484474386276334",
            "username": "janedoe",
        },
        commit=True,
    )
    other_wallet_db: AccountModel = await account_crud.create(
        db=db,
        obj_in={
            "user_id": other_user_db.id,
            "kind": AccountKind.ASSET,
            "name": "Wallet",
            "currency": other_base_currency,
        },
        commit=True,
    )
    request_db: AuthorizationRequestModel = await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now(),
            "link_user_id": user_db.id,
            "used": True,
            "merge_user_id": other_user_db.id,
            "merge_code_hash": hashlib.sha256(b"merge_code").hexdigest(),
            "merge_expires_at": datetime.now() + timedelta(minutes=10),
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises((BaseCurrencyMismatch, ProviderAlreadyLinked)) as exc:
        await merge_service.merge(db=db_transaction, user_id=user_db.id, merge_code="merge_code")
    await db_transaction.commit()

    assert exc.value.error_code == error_code

    # nothing moves and the code stays valid
    await db.refresh(other_wallet_db)
    assert other_wallet_db.user_id == other_user_db.id
    await db.refresh(request_db)
    assert request_db.merge_user_id == other_user_db.id


@pytest.mark.parametrize(
    "merge_code, merge_expires_at, is_own_code",
    [
        ("unknown_code", datetime.now() + timedelta(minutes=10), True),
        ("merge_code", datetime.now() - timedelta(seconds=1), True),
        ("merge_code", datetime.now() + timedelta(minutes=10), False),
    ],
    ids=["unknown_code", "expired_code", "code_of_another_user"],
)
async def test_merge_invalid_code(
    db: AsyncSession, db_transaction: AsyncSession, merge_code: str, merge_expires_at: datetime, is_own_code: bool
):
    # Arrange
    user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="johndoe", registration_provider=ProviderType.TELEGRAM, base_currency="USD"),
        commit=True,
    )
    other_user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="janedoe", registration_provider=ProviderType.GOOGLE, base_currency="USD"),
        commit=True,
    )
    third_user_db: UserModel = await user_crud.create(
        db=db,
        obj_in=UserCreate(username="jackdoe", registration_provider=ProviderType.GOOGLE, base_currency="USD"),
        commit=True,
    )
    await authorization_request_crud.create(
        db=db,
        obj_in={
            "provider": ProviderType.GOOGLE,
            "state": "state",
            "nonce": "nonce",
            "provider_code_verifier": "provider_code_verifier",
            "client_redirect_uri": "https://finance.test/auth/callback",
            "client_state": "client_state",
            "client_code_challenge": "client_code_challenge",
            "expires_at": datetime.now(),
            "link_user_id": user_db.id if is_own_code else third_user_db.id,
            "used": True,
            "merge_user_id": other_user_db.id,
            "merge_code_hash": hashlib.sha256(b"merge_code").hexdigest(),
            "merge_expires_at": merge_expires_at,
        },
        commit=True,
    )

    # Act / Assert
    with pytest.raises(InvalidTokenException) as exc:
        await merge_service.merge(db=db_transaction, user_id=user_db.id, merge_code=merge_code)
    await db_transaction.commit()

    assert exc.value.error_code == ErrorCodeType.INVALID_TOKEN

    other_user_after_db: UserModel | None = await db.scalar(select(UserModel).where(UserModel.id == other_user_db.id))
    assert other_user_after_db is not None
