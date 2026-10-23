from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import (
    CurrencyMismatchException,
    DeletedAccountTransactionForbidden,
    NoAccountBaseCurrencyRate,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import (
    AccountKindMismatch,
    BaseCurrencyAmountNotAllowed,
    FieldNotAllowed,
    FieldRequired,
)
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountKind, MONEY_ACCOUNT_KINDS
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import (
    MovementRequest,
    Transaction,
    TransactionCreate,
    TransactionCreateRequest,
    TransactionType,
)
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import currency_service, ledger_service
from app.services.user import user_service

logger = get_logger(logger_name=__name__)


class TransactionProcessor[T: TransactionCreateRequest](ABC):
    def __init__(self, *, db: AsyncSession, user_id: UUID):
        self.db: AsyncSession = db
        self.user_id: UUID = user_id
        self.base_currency: CurrencyCode | None = None

    @property
    @abstractmethod
    def _transaction_type(self) -> TransactionType:
        pass

    @abstractmethod
    async def _prepare_transaction(self, *, data: T) -> tuple[TransactionCreate, list[PostingCreate]]:
        pass

    @staticmethod
    def _validate_account_is_active(*, account_id: UUID, account_db: AccountModel | None) -> None:
        if account_db is None:
            raise EntityNotFound(entity=AccountModel, search_params={"id": account_id}, logger=logger)

        if account_db.status == EntityStatusType.DELETED:
            raise DeletedAccountTransactionForbidden(account_id=account_db.id, logger=logger)

        if account_db.kind not in MONEY_ACCOUNT_KINDS:
            raise AccountKindMismatch(account_id=account_db.id, kinds=MONEY_ACCOUNT_KINDS, logger=logger)

    def _validate_fields(self, *, required_fields: dict[str, object], forbidden_fields: dict[str, object]) -> None:
        for field, value in required_fields.items():
            if value is None:
                raise FieldRequired(transaction_type=self._transaction_type, field=field, logger=logger)

        for field, value in forbidden_fields.items():
            if value is not None:
                raise FieldNotAllowed(transaction_type=self._transaction_type, field=field, logger=logger)

    @staticmethod
    def _validate_base_currency_amount_not_sent(*, data: MovementRequest) -> None:
        if data.base_currency_amount is not None:
            raise BaseCurrencyAmountNotAllowed(
                account_id=data.from_account_id, base_currency_amount=data.base_currency_amount, logger=logger
            )

    async def _validate_counter_account(self, *, account_id: UUID, kind: AccountKind) -> None:
        account_db: AccountModel | None = await account_crud.get_or_none(
            db=self.db, id=account_id, user_id=self.user_id, kind=kind, status=EntityStatusType.ACTIVE
        )
        if account_db is None:
            raise AccountKindMismatch(account_id=account_id, kinds=[kind], logger=logger)

    async def _validate_transaction_from_account(self, *, data: T, from_account_db: AccountModel | None) -> None:
        self._validate_account_is_active(account_id=data.from_account_id, account_db=from_account_db)

        if from_account_db.currency != data.source_currency:
            raise CurrencyMismatchException(
                account_id=from_account_db.id,
                transaction_currency=data.source_currency,
                account_currency=from_account_db.currency,
                logger=logger,
            )

    async def _validate_transaction_to_account(self, *, data: T, to_account_db: AccountModel | None) -> None:
        self._validate_account_is_active(account_id=data.to_account_id, account_db=to_account_db)

        if to_account_db.currency != data.destination_currency:
            raise CurrencyMismatchException(
                account_id=to_account_db.id,
                transaction_currency=data.destination_currency,
                account_currency=to_account_db.currency,
                logger=logger,
            )

    @staticmethod
    def _get_request_currencies(*, data: T) -> list[CurrencyCode]:
        currencies: list[CurrencyCode] = sorted({data.source_currency, data.destination_currency})
        return currencies

    async def _get_debit_base_amount(
        self, *, account_db: AccountModel, amount: Decimal, transaction_date: date
    ) -> Decimal:
        balance, base_balance = await ledger_service.get_balances_at_date(
            db=self.db, account_db=account_db, transaction_date=transaction_date
        )
        has_rate: bool = ledger_service.has_base_currency_rate(
            currency=account_db.currency, balance=balance, base_balance=base_balance, base_currency=self.base_currency
        )
        if not has_rate:
            raise NoAccountBaseCurrencyRate(account_id=account_db.id, logger=logger)

        base_amount: Decimal = ledger_service.get_base_amount(
            currency=account_db.currency,
            balance=balance,
            base_balance=base_balance,
            amount=amount,
            base_currency=self.base_currency,
        )
        return base_amount

    @staticmethod
    def _get_postings(
        *,
        from_account_id: UUID,
        from_amount: Decimal,
        from_currency: CurrencyCode,
        to_account_id: UUID,
        to_amount: Decimal,
        to_currency: CurrencyCode,
        base_amount: Decimal,
    ) -> list[PostingCreate]:
        postings: list[PostingCreate] = [
            PostingCreate(
                account_id=from_account_id, amount=-from_amount, currency=from_currency, base_amount=-base_amount
            ),
            PostingCreate(account_id=to_account_id, amount=to_amount, currency=to_currency, base_amount=base_amount),
        ]
        return postings

    async def __update_account_balances(self, *, postings_db: list[PostingModel], sign: Decimal) -> None:
        for posting_db in postings_db:
            if posting_db.account.kind in MONEY_ACCOUNT_KINDS:
                await account_crud.add_to_balance(
                    db=self.db,
                    account_id=posting_db.account_id,
                    amount=sign * posting_db.amount,
                    base_amount=sign * posting_db.base_amount,
                )

    async def create(self, *, data: T) -> Transaction:
        self.base_currency = await user_service.get_user_base_currency(db=self.db, user_id=self.user_id)
        await account_crud.lock_money_accounts(db=self.db, user_id=self.user_id)

        currencies: list[CurrencyCode] = self._get_request_currencies(data=data)
        for currency in currencies:
            await currency_service.get_currency(db=self.db, code=currency)

        transaction_data, postings_data = await self._prepare_transaction(data=data)
        try:
            transaction_db: TransactionModel = await transaction_crud.create_with_postings(
                db=self.db, obj_in=transaction_data, postings=postings_data
            )

        except IntegrityError as exc:
            raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

        await self.__update_account_balances(postings_db=transaction_db.postings, sign=Decimal("1"))
        await ledger_service.recalculate_accounts(
            db=self.db, transaction_db=transaction_db, base_currency=self.base_currency
        )

        transaction_db: TransactionModel = await transaction_crud.get_refreshed(
            db=self.db, transaction_id=transaction_db.id
        )
        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction

    async def delete(self, *, transaction_id: UUID) -> Transaction:
        await account_crud.lock_money_accounts(db=self.db, user_id=self.user_id)
        transaction_db: TransactionModel | None = await transaction_crud.get_or_none(
            db=self.db,
            id=transaction_id,
            user_id=self.user_id,
            transaction_type=self._transaction_type,
            status=EntityStatusType.ACTIVE,
            with_for_update=True,
        )
        if transaction_db is None:
            raise EntityNotFound(
                entity=TransactionModel, search_params={"id": transaction_id, "user_id": self.user_id}, logger=logger
            )

        self.base_currency = await user_service.get_user_base_currency(db=self.db, user_id=self.user_id)
        account_ids: list[UUID] = [
            posting_db.account_id
            for posting_db in transaction_db.postings
            if posting_db.account.kind in MONEY_ACCOUNT_KINDS
        ]
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=account_ids, user_id=self.user_id
        )
        for account_db in accounts_db.values():
            self._validate_account_is_active(account_id=account_db.id, account_db=account_db)

        delete_update_data = {"status": EntityStatusType.DELETED}
        transaction_db: TransactionModel = await transaction_crud.update_api(
            db=self.db, db_obj=transaction_db, obj_in=delete_update_data
        )
        await self.__update_account_balances(postings_db=transaction_db.postings, sign=Decimal("-1"))
        await ledger_service.recalculate_accounts(
            db=self.db, transaction_db=transaction_db, base_currency=self.base_currency
        )

        transaction_db: TransactionModel = await transaction_crud.get_refreshed(
            db=self.db, transaction_id=transaction_db.id
        )
        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction
