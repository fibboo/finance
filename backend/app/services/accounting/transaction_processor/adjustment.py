from datetime import date
from decimal import Decimal
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.exceptions.forbidden_403 import NoAccountBaseCurrencyRate
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import BaseCurrencyAmountNotAllowed
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AccountKind, AdjustmentCreate
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import TransactionCreate, TransactionType
from app.schemas.base import CurrencyCode, EntityStatusType
from app.services.accounting import ledger_service
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


class Adjustment(TransactionProcessor[AdjustmentCreate]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.ADJUSTMENT

    @staticmethod
    def _get_request_currencies(*, data: AdjustmentCreate) -> list[CurrencyCode]:
        currencies: list[CurrencyCode] = []
        return currencies

    @staticmethod
    def _validate_update(*, data: AdjustmentCreate, transaction_db: TransactionModel) -> None:
        account_dates: dict[UUID, date] = ledger_service.get_money_account_dates(transaction_db=transaction_db)
        if data.account_id not in account_dates:
            raise EntityNotFound(
                entity=TransactionModel,
                search_params={"id": transaction_db.id, "account_id": data.account_id},
                logger=logger,
            )

    async def __get_base_currency_amount(
        self, *, data: AdjustmentCreate, account_db: AccountModel, amount: Decimal
    ) -> Decimal:
        balance, base_balance = await ledger_service.get_balances_at_date(
            db=self.db, account_db=account_db, transaction_date=data.transaction_date
        )
        has_rate: bool = ledger_service.has_base_currency_rate(
            currency=account_db.currency, balance=balance, base_balance=base_balance, base_currency=self.base_currency
        )
        if has_rate:
            if data.base_currency_amount is not None:
                raise BaseCurrencyAmountNotAllowed(
                    account_id=account_db.id, base_currency_amount=data.base_currency_amount, logger=logger
                )

            base_currency_amount: Decimal = ledger_service.get_base_amount(
                currency=account_db.currency,
                balance=balance,
                base_balance=base_balance,
                amount=amount,
                base_currency=self.base_currency,
            )
        elif data.base_currency_amount is not None:
            base_currency_amount: Decimal = data.base_currency_amount
        else:
            raise NoAccountBaseCurrencyRate(account_id=account_db.id, logger=logger)

        return base_currency_amount

    async def _prepare_transaction(self, *, data: AdjustmentCreate) -> tuple[TransactionCreate, list[PostingCreate]]:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.account_id], user_id=self.user_id
        )
        account_db: AccountModel | None = accounts_db.get(data.account_id)
        if account_db is not None and account_db.kind == AccountKind.EQUITY:
            raise EntityNotFound(entity=AccountModel, search_params={"id": data.account_id}, logger=logger)

        self._validate_account_is_active(account_id=data.account_id, account_db=account_db)

        equity_account_db: AccountModel | None = await account_crud.get_or_none(
            db=self.db, user_id=self.user_id, kind=AccountKind.EQUITY, status=EntityStatusType.ACTIVE
        )
        if equity_account_db is None:
            raise EntityNotFound(
                entity=AccountModel, search_params={"user_id": self.user_id, "kind": AccountKind.EQUITY}, logger=logger
            )

        amount: Decimal = abs(data.amount)
        base_currency_amount: Decimal = await self.__get_base_currency_amount(
            data=data, account_db=account_db, amount=amount
        )
        transaction_data: TransactionCreate = TransactionCreate(
            user_id=self.user_id,
            transaction_type=self._transaction_type,
            transaction_date=data.transaction_date,
            comment=data.comment,
            base_currency_amount=base_currency_amount,
        )
        if data.amount > 0:
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
