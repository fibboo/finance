from decimal import Decimal
from uuid import UUID

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import CRUDExpenseTransaction, expense_transaction_crud
from app.exceptions.forbidden_403 import AccountTypeMismatchException
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import ExpenseTransaction as ExpenseTransactionModel
from app.schemas.accounting.account import AccountType
from app.schemas.accounting.transaction import ExpenseRequest, Transaction, TransactionCreate, TransactionType
from app.services.accounting import category_service, location_service
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


class Expense(TransactionProcessor[ExpenseRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.EXPENSE

    @property
    def _transaction_crud(self) -> CRUDExpenseTransaction:
        return expense_transaction_crud

    @staticmethod
    def _get_transaction_accounts(*, transaction_db: ExpenseTransactionModel) -> list[AccountModel]:
        accounts_db: list[AccountModel] = [transaction_db.from_account]
        return accounts_db

    async def _validate_transaction_from_account(
        self, *, data: ExpenseRequest, from_account_db: AccountModel | None
    ) -> None:
        await super()._validate_transaction_from_account(data=data, from_account_db=from_account_db)

        if from_account_db.account_type != AccountType.CHECKING:
            raise AccountTypeMismatchException(
                account_id=from_account_db.id,
                transaction_type=self._transaction_type,
                account_type=from_account_db.account_type,
                logger=logger,
            )

    async def _validate_transaction_to_account(
        self, *, data: ExpenseRequest, to_account_db: AccountModel | None
    ) -> None:
        pass

    async def _prepare_transaction(self, *, data: ExpenseRequest) -> TransactionCreate:
        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.from_account_id], user_id=self.user_id
        )
        from_account: AccountModel | None = accounts_db.get(data.from_account_id)
        await self._validate_transaction_from_account(data=data, from_account_db=from_account)

        await category_service.get_category(db=self.db, category_id=data.category_id, user_id=self.user_id)
        await location_service.get_location(db=self.db, location_id=data.location_id, user_id=self.user_id)

        base_currency_amount: Decimal = data.source_amount / from_account.base_currency_rate
        transaction_data: TransactionCreate = TransactionCreate(
            **data.model_dump(), user_id=self.user_id, base_currency_amount=base_currency_amount
        )
        return transaction_data

    async def _update_to_account(self, *, transaction_db: Transaction, is_delete: bool = False) -> None:
        pass
