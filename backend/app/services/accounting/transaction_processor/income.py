from decimal import Decimal
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDIncomeTransaction, income_transaction_crud
from app.exceptions.unprocessable_422 import BaseCurrencyAmountNotAllowed, BaseCurrencyAmountRequired
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import IncomeTransaction as IncomeTransactionModel
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.transaction import IncomeRequest, TransactionCreate, TransactionType
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


class Income(TransactionProcessor[IncomeRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.INCOME

    @property
    def _transaction_crud(self) -> type[CRUDIncomeTransaction]:
        return income_transaction_crud

    @staticmethod
    def _get_transaction_accounts(*, transaction_db: IncomeTransactionModel) -> list[AccountModel]:
        accounts_db: list[AccountModel] = [transaction_db.to_account]
        return accounts_db

    async def _validate_transaction_from_account(
        self, *, data: IncomeRequest, from_account_db: AccountModel | None
    ) -> None:
        pass

    def __get_base_currency_amount(self, *, data: IncomeRequest) -> Decimal:
        is_base_currency_amount_derived: bool = self.base_currency in (data.source_currency, data.destination_currency)
        if is_base_currency_amount_derived and data.base_currency_amount is not None:
            raise BaseCurrencyAmountNotAllowed(
                account_id=data.to_account_id, base_currency_amount=data.base_currency_amount, logger=logger
            )

        if not is_base_currency_amount_derived and data.base_currency_amount is None:
            raise BaseCurrencyAmountRequired(currency=data.source_currency, logger=logger)

        if data.destination_currency == self.base_currency:
            base_currency_amount: Decimal = data.destination_amount
        elif data.source_currency == self.base_currency:
            base_currency_amount: Decimal = data.source_amount
        else:
            base_currency_amount: Decimal = data.base_currency_amount

        return base_currency_amount

    async def _prepare_transaction(self, *, data: IncomeRequest) -> TransactionCreate:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.to_account_id], user_id=self.user_id
        )
        to_account_db: AccountModel | None = accounts_db.get(data.to_account_id)
        await self._validate_transaction_to_account(data=data, to_account_db=to_account_db)

        await self._validate_counter_account(account_id=data.income_source_id, kind=AccountKind.INCOME)

        base_currency_amount: Decimal = self.__get_base_currency_amount(data=data)
        transaction_data: TransactionCreate = TransactionCreate(
            **data.model_dump(exclude={"base_currency_amount"}),
            user_id=self.user_id,
            base_currency_amount=base_currency_amount,
        )
        return transaction_data

    async def _update_from_account(self, *, transaction_db: IncomeTransactionModel) -> None:
        pass
