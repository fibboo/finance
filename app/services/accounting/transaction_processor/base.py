from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.base import CRUDBase
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.forbidden_403 import CurrencyMismatchException, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.transaction import (Transaction, TransactionCreate, TransactionCreateRequest,
                                                TransactionType)
from app.schemas.base import CurrencyType, EntityStatusType
from app.services.user import user_service

T = TypeVar('T', bound=TransactionCreateRequest)

logger = get_logger(__name__)


class TransactionProcessor(ABC, Generic[T]):
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db: AsyncSession = db
        self.user_id: UUID = user_id
        self.base_currency: CurrencyType | None = None

    @classmethod
    def factory(cls, db: AsyncSession, user_id: UUID, transaction_type: TransactionType) -> 'TransactionProcessor':
        from app.services.accounting.transaction_processor.income import Income
        from app.services.accounting.transaction_processor.expense import Expense
        from app.services.accounting.transaction_processor.transfer import Transfer

        type_processor = {TransactionType.EXPENSE: Expense,
                          TransactionType.INCOME: Income,
                          TransactionType.TRANSFER: Transfer}
        transaction_class: type[TransactionProcessor] | None = type_processor.get(transaction_type, None)
        if transaction_class is None:
            raise NotImplementedException(log_message=f'Transaction {transaction_type.__name__} is not implemented',
                                          logger=logger)

        transaction_processor: TransactionProcessor = transaction_class(db=db, user_id=user_id)
        return transaction_processor

    @property
    @abstractmethod
    def _transaction_type(self) -> TransactionType:
        pass

    @property
    @abstractmethod
    def _transaction_crud(self) -> CRUDBase:
        pass

    async def _validate_transaction_from_account(self, data: T, from_account_db: AccountModel | None) -> None:
        if from_account_db is None:
            raise EntityNotFound(entity=AccountModel, search_params={'id': data.from_account_id}, logger=logger)

        if from_account_db.base_currency_rate == 0:
            raise NoAccountBaseCurrencyRate(account_id=from_account_db.id, logger=logger)

        if from_account_db.currency != data.source_currency:
            raise CurrencyMismatchException(account_id=from_account_db.id,
                                            transaction_currency=data.source_currency,
                                            account_currency=from_account_db.currency,
                                            logger=logger)

    async def _validate_transaction_to_account(self, data: T, to_account_db: AccountModel | None) -> None:
        if to_account_db is None:
            raise EntityNotFound(entity=AccountModel, search_params={'id': data.to_account_id}, logger=logger)

        if to_account_db.currency != data.destination_currency:
            raise CurrencyMismatchException(account_id=to_account_db.id,
                                            transaction_currency=data.destination_currency,
                                            account_currency=to_account_db.currency,
                                            logger=logger)

    @abstractmethod
    async def _prepare_transaction(self, data: T) -> TransactionCreate:
        pass

    async def _update_from_account(self, transaction_db: TransactionModel, is_delete: bool = False) -> None:
        delta = transaction_db.source_amount if is_delete else -transaction_db.source_amount
        new_balance: Decimal = transaction_db.from_account.balance + delta
        await account_crud.update_orm(db=self.db,
                                      id=transaction_db.from_account_id,
                                      obj_in={'balance': new_balance})

    async def _update_to_account(self, transaction_db: TransactionModel, is_delete: bool = False) -> None:
        delta = -transaction_db.destination_amount if is_delete else transaction_db.destination_amount
        new_balance: Decimal = transaction_db.to_account.balance + delta
        if new_balance == 0:
            new_base_rate: Decimal = Decimal('0')
        elif transaction_db.to_account.currency == self.base_currency:
            new_base_rate: Decimal = Decimal('1')
        elif transaction_db.to_account.base_currency_rate == 0:
            new_base_rate: Decimal = transaction_db.destination_amount / transaction_db.source_amount
        else:
            current_base_balance: Decimal = transaction_db.to_account.balance / transaction_db.to_account.base_currency_rate
            delta = -transaction_db.base_currency_amount if is_delete else transaction_db.base_currency_amount
            new_base_balance: Decimal = current_base_balance + delta
            new_base_rate: Decimal = new_balance / new_base_balance

        new_balance: Decimal = new_balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        new_base_rate: Decimal = new_base_rate.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN)
        await account_crud.update_orm(db=self.db,
                                      id=transaction_db.to_account_id,
                                      obj_in={'balance': new_balance, 'base_currency_rate': new_base_rate})

    async def create(self, data: T) -> Transaction:
        self.base_currency = await user_service.get_user_base_currency(db=self.db, user_id=self.user_id)

        transaction_data: TransactionCreate = await self._prepare_transaction(data=data)
        try:
            transaction_db: TransactionModel = await self._transaction_crud.create(db=self.db, obj_in=transaction_data)

        except IntegrityError as exc:
            raise IntegrityException(entity=TransactionModel, exception=exc, logger=logger)

        await self._update_from_account(transaction_db=transaction_db)
        await self._update_to_account(transaction_db=transaction_db)

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction

    async def delete(self, transaction_db: TransactionModel) -> Transaction:
        delete_update_data = {'status': EntityStatusType.DELETED}
        transaction_db: TransactionModel = await self._transaction_crud.update_api(db=self.db,
                                                                                   db_obj=transaction_db,
                                                                                   obj_in=delete_update_data)

        await self._update_from_account(transaction_db=transaction_db, is_delete=True)
        await self._update_to_account(transaction_db=transaction_db, is_delete=True)

        transaction: Transaction = Transaction.model_validate(transaction_db)
        return transaction
