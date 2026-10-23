from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_EVEN
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
from app.exceptions.unprocessable_422 import AccountKindMismatch
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.posting import Posting as PostingModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountKind, MONEY_ACCOUNT_KINDS
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import Transaction, TransactionCreate, TransactionCreateRequest, TransactionType
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import currency_service
from app.services.user import user_service
from app.utils import utils

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

    async def _validate_counter_account(self, *, account_id: UUID, kind: AccountKind) -> None:
        account_db: AccountModel | None = await account_crud.get_or_none(
            db=self.db, id=account_id, user_id=self.user_id, kind=kind, status=EntityStatusType.ACTIVE
        )
        if account_db is None:
            raise AccountKindMismatch(account_id=account_id, kinds=[kind], logger=logger)

    async def _validate_transaction_from_account(self, *, data: T, from_account_db: AccountModel | None) -> None:
        self._validate_account_is_active(account_id=data.from_account_id, account_db=from_account_db)

        has_rate: bool = self._has_rate(account_db=from_account_db, base_currency=self.base_currency)
        if not has_rate:
            raise NoAccountBaseCurrencyRate(account_id=from_account_db.id, logger=logger)

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

    @staticmethod
    def __quantize_amount(*, amount: Decimal) -> Decimal:
        quantized_amount: Decimal = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
        quantized_amount: Decimal = max(quantized_amount, Decimal("0.01"))
        return quantized_amount

    @staticmethod
    def _has_rate(*, account_db: AccountModel, base_currency: CurrencyCode | None) -> bool:
        base_currency_rate: Decimal = utils.get_base_currency_rate(
            balance=account_db.balance, base_balance=account_db.base_balance
        )
        has_rate: bool = account_db.currency == base_currency or base_currency_rate > 0
        return has_rate

    @staticmethod
    def _get_base_amount(*, account_db: AccountModel, amount: Decimal, base_currency: CurrencyCode | None) -> Decimal:
        if account_db.currency == base_currency:
            base_amount: Decimal = amount
        elif amount == abs(account_db.balance):
            base_amount: Decimal = abs(account_db.base_balance)
        else:
            base_amount: Decimal = TransactionProcessor.__quantize_amount(
                amount=amount * account_db.base_balance / account_db.balance
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

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction

    async def delete(self, *, transaction_id: UUID) -> Transaction:
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

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction
