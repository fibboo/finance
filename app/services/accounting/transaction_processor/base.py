from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_EVEN
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.base import CRUDBase
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import (
    CurrencyMismatchException,
    DeletedAccountTransactionForbidden,
    NoAccountBaseCurrencyRate,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.transaction import Transaction, TransactionCreate, TransactionCreateRequest, TransactionType
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import currency_service
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

    @property
    @abstractmethod
    def _transaction_crud(self) -> CRUDBase:
        pass

    @staticmethod
    @abstractmethod
    def _get_transaction_accounts(*, transaction_db: TransactionModel) -> list[AccountModel]:
        pass

    @staticmethod
    def _validate_account_is_active(*, account_id: UUID, account_db: AccountModel | None) -> None:
        if account_db is None:
            raise EntityNotFound(entity=AccountModel, search_params={"id": account_id}, logger=logger)

        if account_db.status == EntityStatusType.DELETED:
            raise DeletedAccountTransactionForbidden(account_id=account_db.id, logger=logger)

    async def _validate_transaction_from_account(self, *, data: T, from_account_db: AccountModel | None) -> None:
        self._validate_account_is_active(account_id=data.from_account_id, account_db=from_account_db)

        if from_account_db.base_currency_rate == 0:
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

    @abstractmethod
    async def _prepare_transaction(self, *, data: T) -> TransactionCreate:
        pass

    @staticmethod
    def _get_request_currencies(*, data: T) -> list[CurrencyCode]:
        currencies: list[CurrencyCode] = sorted({data.source_currency, data.destination_currency})
        return currencies

    @staticmethod
    def _get_from_account_delta(*, transaction_db: TransactionModel) -> Decimal:
        if transaction_db.status == EntityStatusType.DELETED:
            delta: Decimal = transaction_db.source_amount
        else:
            delta: Decimal = -transaction_db.source_amount

        return delta

    @staticmethod
    def _get_to_account_delta(*, transaction_db: TransactionModel) -> Decimal:
        if transaction_db.status == EntityStatusType.DELETED:
            delta: Decimal = -transaction_db.destination_amount
        else:
            delta: Decimal = transaction_db.destination_amount

        return delta

    @staticmethod
    def _get_from_account_base_currency_delta(*, transaction_db: TransactionModel) -> Decimal:
        if transaction_db.status == EntityStatusType.DELETED:
            base_currency_delta: Decimal = transaction_db.base_currency_amount
        else:
            base_currency_delta: Decimal = -transaction_db.base_currency_amount

        return base_currency_delta

    @staticmethod
    def _get_to_account_base_currency_delta(*, transaction_db: TransactionModel) -> Decimal:
        if transaction_db.status == EntityStatusType.DELETED:
            base_currency_delta: Decimal = -transaction_db.base_currency_amount
        else:
            base_currency_delta: Decimal = transaction_db.base_currency_amount

        return base_currency_delta

    @staticmethod
    def _get_credit_rate(
        *,
        account_db: AccountModel,
        transaction_db: TransactionModel,
        new_balance: Decimal,
        base_currency_delta: Decimal,
        base_currency: CurrencyCode | None,
    ) -> Decimal:
        if new_balance == 0:
            new_base_rate: Decimal = Decimal("0")
        elif account_db.currency == base_currency:
            new_base_rate: Decimal = Decimal("1")
        elif account_db.base_currency_rate == 0 or account_db.balance <= 0 < new_balance:
            new_base_rate: Decimal = transaction_db.destination_amount / transaction_db.base_currency_amount
        elif account_db.balance > 0 and new_balance > 0:
            new_base_balance: Decimal = account_db.balance / account_db.base_currency_rate + base_currency_delta
            if new_base_balance > 0:
                new_base_rate: Decimal = new_balance / new_base_balance
            else:
                new_base_rate: Decimal = account_db.base_currency_rate
        else:
            new_base_rate: Decimal = account_db.base_currency_rate

        new_base_rate: Decimal = new_base_rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN)
        return new_base_rate

    async def _update_from_account(self, *, transaction_db: TransactionModel) -> None:
        if transaction_db.from_account_id is None:
            return

        delta: Decimal = self._get_from_account_delta(transaction_db=transaction_db)
        new_balance: Decimal = transaction_db.from_account.balance + delta
        await account_crud.update_orm(db=self.db, id=transaction_db.from_account_id, obj_in={"balance": new_balance})

    async def _update_to_account(self, *, transaction_db: TransactionModel) -> None:
        if transaction_db.to_account_id is None:
            return

        delta: Decimal = self._get_to_account_delta(transaction_db=transaction_db)
        base_currency_delta: Decimal = self._get_to_account_base_currency_delta(transaction_db=transaction_db)
        new_balance: Decimal = transaction_db.to_account.balance + delta
        new_base_rate: Decimal = self._get_credit_rate(
            account_db=transaction_db.to_account,
            transaction_db=transaction_db,
            new_balance=new_balance,
            base_currency_delta=base_currency_delta,
            base_currency=self.base_currency,
        )
        new_balance: Decimal = new_balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
        await account_crud.update_orm(
            db=self.db,
            id=transaction_db.to_account_id,
            obj_in={"balance": new_balance, "base_currency_rate": new_base_rate},
        )

    async def create(self, *, data: T) -> Transaction:
        self.base_currency = await user_service.get_user_base_currency(db=self.db, user_id=self.user_id)

        currencies: list[CurrencyCode] = self._get_request_currencies(data=data)
        for currency in currencies:
            await currency_service.get_currency(db=self.db, code=currency)

        transaction_data: TransactionCreate = await self._prepare_transaction(data=data)
        try:
            transaction_db: TransactionModel = await self._transaction_crud.create(db=self.db, obj_in=transaction_data)

        except IntegrityError as exc:
            raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

        await self._update_from_account(transaction_db=transaction_db)
        await self._update_to_account(transaction_db=transaction_db)

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction

    async def delete(self, *, transaction_id: UUID) -> Transaction:
        transaction_db: TransactionModel | None = await self._transaction_crud.get_or_none(
            db=self.db, id=transaction_id, user_id=self.user_id, status=EntityStatusType.ACTIVE, with_for_update=True
        )
        if transaction_db is None:
            raise EntityNotFound(
                entity=TransactionModel, search_params={"id": transaction_id, "user_id": self.user_id}, logger=logger
            )

        transaction_accounts_db: list[AccountModel] = self._get_transaction_accounts(transaction_db=transaction_db)
        account_ids: list[UUID] = [account_db.id for account_db in transaction_accounts_db]
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=account_ids, user_id=self.user_id
        )
        for account_db in accounts_db.values():
            self._validate_account_is_active(account_id=account_db.id, account_db=account_db)

        delete_update_data = {"status": EntityStatusType.DELETED}
        transaction_db: TransactionModel = await self._transaction_crud.update_api(
            db=self.db, db_obj=transaction_db, obj_in=delete_update_data
        )

        await self._update_from_account(transaction_db=transaction_db)
        await self._update_to_account(transaction_db=transaction_db)

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction
