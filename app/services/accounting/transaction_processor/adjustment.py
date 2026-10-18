from decimal import Decimal, ROUND_HALF_EVEN
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import adjustment_transaction_crud, CRUDAdjustmentTransaction
from app.exceptions.forbidden_403 import DeletedAccountTransactionForbidden, NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountBalanceUnchanged
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import AdjustmentTransaction as AdjustmentTransactionModel
from app.schemas.accounting.transaction import AdjustmentRequest, TransactionCreate, TransactionType
from app.schemas.base import EntityStatusType
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
        account_db: AccountModel = (
            transaction_db.to_account if transaction_db.to_account is not None else transaction_db.from_account
        )
        accounts_db: list[AccountModel] = [account_db]
        return accounts_db

    @staticmethod
    def __validate_account(*, data: AdjustmentRequest, account_db: AccountModel | None) -> None:
        if account_db is None:
            raise EntityNotFound(entity=AccountModel, search_params={"id": data.account_id}, logger=logger)

        if account_db.status == EntityStatusType.DELETED:
            raise DeletedAccountTransactionForbidden(account_id=account_db.id, logger=logger)

        if account_db.balance == data.new_balance:
            raise AccountBalanceUnchanged(account_id=account_db.id, balance=account_db.balance, logger=logger)

    def __get_base_currency_amount(
        self, *, data: AdjustmentRequest, account_db: AccountModel, amount: Decimal
    ) -> Decimal:
        if account_db.currency == self.base_currency:
            base_currency_amount: Decimal = amount
        elif account_db.base_currency_rate != 0:
            base_currency_amount: Decimal = amount / account_db.base_currency_rate
            base_currency_amount: Decimal = base_currency_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
        elif data.base_currency_amount is not None:
            base_currency_amount: Decimal = data.base_currency_amount
        else:
            raise NoAccountBaseCurrencyRate(account_id=account_db.id, logger=logger)

        return base_currency_amount

    async def _prepare_transaction(self, *, data: AdjustmentRequest) -> TransactionCreate:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.account_id], user_id=self.user_id
        )
        account_db: AccountModel | None = accounts_db.get(data.account_id)
        self.__validate_account(data=data, account_db=account_db)

        difference: Decimal = data.new_balance - account_db.balance
        amount: Decimal = abs(difference)
        base_currency_amount: Decimal = self.__get_base_currency_amount(data=data, account_db=account_db, amount=amount)
        account_side: str = "to_account_id" if difference > 0 else "from_account_id"
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
            **{account_side: account_db.id},
        )
        return transaction_data
