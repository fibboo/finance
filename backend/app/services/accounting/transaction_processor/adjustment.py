from decimal import Decimal
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.exceptions.forbidden_403 import NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountBalanceUnchanged, BaseCurrencyAmountNotAllowed
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import AdjustmentRequest, TransactionCreate, TransactionType
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


class Adjustment(TransactionProcessor[AdjustmentRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.ADJUSTMENT

    @staticmethod
    def _get_request_currencies(*, data: AdjustmentRequest) -> list[CurrencyCode]:
        currencies: list[CurrencyCode] = []
        return currencies

    def __get_base_currency_amount(
        self, *, data: AdjustmentRequest, account_db: AccountModel, amount: Decimal
    ) -> Decimal:
        has_rate: bool = self._has_rate(account_db=account_db, base_currency=self.base_currency)
        if has_rate:
            if data.base_currency_amount is not None:
                raise BaseCurrencyAmountNotAllowed(
                    account_id=account_db.id, base_currency_amount=data.base_currency_amount, logger=logger
                )

            base_currency_amount: Decimal = self._get_base_amount(
                account_db=account_db, amount=amount, base_currency=self.base_currency
            )
        elif data.base_currency_amount is not None:
            base_currency_amount: Decimal = data.base_currency_amount
        else:
            raise NoAccountBaseCurrencyRate(account_id=account_db.id, logger=logger)

        return base_currency_amount

    async def _prepare_transaction(self, *, data: AdjustmentRequest) -> tuple[TransactionCreate, list[PostingCreate]]:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.account_id], user_id=self.user_id
        )
        account_db: AccountModel | None = accounts_db.get(data.account_id)
        self._validate_account_is_active(account_id=data.account_id, account_db=account_db)

        if account_db.balance == data.new_balance:
            raise AccountBalanceUnchanged(account_id=account_db.id, balance=account_db.balance, logger=logger)

        equity_account_db: AccountModel | None = await account_crud.get_or_none(
            db=self.db, user_id=self.user_id, kind=AccountKind.EQUITY, status=EntityStatusType.ACTIVE
        )
        if equity_account_db is None:
            raise EntityNotFound(
                entity=AccountModel, search_params={"user_id": self.user_id, "kind": AccountKind.EQUITY}, logger=logger
            )

        difference: Decimal = data.new_balance - account_db.balance
        amount: Decimal = abs(difference)
        base_currency_amount: Decimal = self.__get_base_currency_amount(data=data, account_db=account_db, amount=amount)
        transaction_data: TransactionCreate = TransactionCreate(
            user_id=self.user_id,
            transaction_type=self._transaction_type,
            transaction_date=data.transaction_date,
            comment=data.comment,
            base_currency_amount=base_currency_amount,
        )
        if difference > 0:
            from_account_id, to_account_id = equity_account_db.id, account_db.id
        else:
            from_account_id, to_account_id = account_db.id, equity_account_db.id

        postings: list[PostingCreate] = self._get_postings(
            from_account_id=from_account_id,
            from_amount=amount,
            from_currency=account_db.currency,
            to_account_id=to_account_id,
            to_amount=amount,
            to_currency=account_db.currency,
            base_amount=base_currency_amount,
        )
        return transaction_data, postings
