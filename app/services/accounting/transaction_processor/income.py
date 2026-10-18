from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.income_source import income_source_crud
from app.crud.accounting.transaction import CRUDIncomeTransaction, income_transaction_crud
from app.exceptions.forbidden_403 import AccountTypeMismatchException
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.income_source import IncomeSource as IncomeSourceModel
from app.models.accounting.transaction import IncomeTransaction as IncomeTransactionModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.transaction import IncomeRequest, Transaction, TransactionCreate, TransactionType
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

    async def _validate_transaction_to_account(
        self, *, data: IncomeRequest, to_account_db: AccountModel | None
    ) -> None:
        await super()._validate_transaction_to_account(data=data, to_account_db=to_account_db)

        if to_account_db.account_type != AccountType.INCOME:
            raise AccountTypeMismatchException(
                account_id=to_account_db.id,
                transaction_type=self._transaction_type,
                account_type=to_account_db.account_type,
                logger=logger,
            )

    async def _prepare_transaction(self, *, data: IncomeRequest) -> TransactionCreate:
        to_account_db: AccountModel | None = await account_crud.get_or_none(
            db=self.db, id=data.to_account_id, user_id=self.user_id
        )
        await self._validate_transaction_to_account(data=data, to_account_db=to_account_db)

        income_source_db: IncomeSourceModel | None = await income_source_crud.get_or_none(
            db=self.db, id=data.income_source_id, user_id=self.user_id
        )
        if income_source_db is None:
            raise EntityNotFound(entity=IncomeSourceModel, search_params={"id": data.income_source_id}, logger=logger)

        transaction_data: TransactionCreate = TransactionCreate(
            **data.model_dump(), user_id=self.user_id, base_currency_amount=data.source_amount
        )
        return transaction_data

    async def _update_from_account(self, *, transaction_db: Transaction, is_delete: bool = False) -> None:
        pass
