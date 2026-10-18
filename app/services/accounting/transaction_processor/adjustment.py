from decimal import Decimal, ROUND_HALF_EVEN
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import adjustment_transaction_crud, CRUDAdjustmentTransaction
from app.exceptions.forbidden_403 import NoAccountBaseCurrencyRate
from app.exceptions.unprocessable_422 import AccountBalanceUnchanged, BaseCurrencyAmountNotAllowed
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import AdjustmentTransaction as AdjustmentTransactionModel
from app.schemas.accounting.transaction import AdjustmentRequest, TransactionCreate, TransactionType
from app.schemas.base import CurrencyCode
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


class Adjustment(TransactionProcessor[AdjustmentRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.ADJUSTMENT

    @property
    def _transaction_crud(self) -> CRUDAdjustmentTransaction:
        return adjustment_transaction_crud

    @staticmethod
    def _get_transaction_accounts(*, transaction_db: AdjustmentTransactionModel) -> list[AccountModel]:
        if transaction_db.to_account is not None:
            account_db: AccountModel = transaction_db.to_account
        else:
            account_db: AccountModel = transaction_db.from_account

        accounts_db: list[AccountModel] = [account_db]
        return accounts_db

    @staticmethod
    def _get_request_currencies(*, data: AdjustmentRequest) -> list[CurrencyCode]:
        currencies: list[CurrencyCode] = []
        return currencies

    def __get_base_currency_amount(
        self, *, data: AdjustmentRequest, account_db: AccountModel, amount: Decimal
    ) -> Decimal:
        is_rate_known: bool = account_db.currency == self.base_currency or account_db.base_currency_rate != 0
        if is_rate_known and data.base_currency_amount is not None:
            raise BaseCurrencyAmountNotAllowed(account_id=account_db.id, logger=logger)

        if account_db.currency == self.base_currency:
            base_currency_amount: Decimal = amount
        elif account_db.base_currency_rate != 0:
            base_currency_amount: Decimal = amount / account_db.base_currency_rate
            base_currency_amount: Decimal = base_currency_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
            base_currency_amount: Decimal = max(base_currency_amount, Decimal("0.01"))
        elif data.base_currency_amount is not None:
            base_currency_amount: Decimal = data.base_currency_amount
        else:
            raise NoAccountBaseCurrencyRate(account_id=account_db.id, logger=logger)

        return base_currency_amount

    @staticmethod
    def __get_adjusted_rate(
        *,
        account_db: AccountModel,
        new_balance: Decimal,
        transaction_db: AdjustmentTransactionModel,
        base_currency: CurrencyCode | None,
    ) -> Decimal:
        if new_balance == 0:
            new_base_rate: Decimal = Decimal("0")
        elif account_db.base_currency_rate != 0:
            new_base_rate: Decimal = account_db.base_currency_rate
        elif account_db.currency == base_currency:
            new_base_rate: Decimal = Decimal("1")
        else:
            new_base_rate: Decimal = transaction_db.source_amount / transaction_db.base_currency_amount
            new_base_rate: Decimal = new_base_rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN)

        return new_base_rate

    async def __update_account(
        self, *, transaction_db: AdjustmentTransactionModel, account_db: AccountModel, delta: Decimal
    ) -> None:
        new_balance: Decimal = account_db.balance + delta
        new_base_rate: Decimal = self.__get_adjusted_rate(
            account_db=account_db,
            new_balance=new_balance,
            transaction_db=transaction_db,
            base_currency=self.base_currency,
        )
        await account_crud.update_orm(
            db=self.db, id=account_db.id, obj_in={"balance": new_balance, "base_currency_rate": new_base_rate}
        )

    async def _prepare_transaction(self, *, data: AdjustmentRequest) -> TransactionCreate:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.account_id], user_id=self.user_id
        )
        account_db: AccountModel | None = accounts_db.get(data.account_id)
        self._validate_account_is_active(account_id=data.account_id, account_db=account_db)

        if account_db.balance == data.new_balance:
            raise AccountBalanceUnchanged(account_id=account_db.id, balance=account_db.balance, logger=logger)

        difference: Decimal = data.new_balance - account_db.balance
        amount: Decimal = abs(difference)
        base_currency_amount: Decimal = self.__get_base_currency_amount(data=data, account_db=account_db, amount=amount)
        transaction_data: TransactionCreate = TransactionCreate(
            transaction_date=data.transaction_date,
            comment=data.comment,
            source_amount=amount,
            source_currency=account_db.currency,
            destination_amount=amount,
            destination_currency=account_db.currency,
            transaction_type=self._transaction_type,
            user_id=self.user_id,
            base_currency_amount=base_currency_amount,
            to_account_id=account_db.id if difference > 0 else None,
            from_account_id=account_db.id if difference < 0 else None,
        )
        return transaction_data

    async def _update_from_account(self, *, transaction_db: AdjustmentTransactionModel) -> None:
        if transaction_db.from_account_id is None:
            return

        delta: Decimal = self._get_from_account_delta(transaction_db=transaction_db)
        await self.__update_account(transaction_db=transaction_db, account_db=transaction_db.from_account, delta=delta)

    async def _update_to_account(self, *, transaction_db: AdjustmentTransactionModel) -> None:
        if transaction_db.to_account_id is None:
            return

        delta: Decimal = self._get_to_account_delta(transaction_db=transaction_db)
        await self.__update_account(transaction_db=transaction_db, account_db=transaction_db.to_account, delta=delta)
