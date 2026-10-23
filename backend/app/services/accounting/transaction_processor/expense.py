from decimal import Decimal
from uuid import UUID

from app.crud.accounting.account import account_crud
from app.models.accounting.account import Account as AccountModel
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.posting import PostingCreate
from app.schemas.accounting.transaction import MovementRequest, TransactionCreate, TransactionType
from app.services.accounting import ledger_service, location_service
from app.services.accounting.transaction_processor.base import TransactionProcessor


class Expense(TransactionProcessor[MovementRequest]):
    @property
    def _transaction_type(self) -> TransactionType:
        return TransactionType.EXPENSE

    async def _prepare_transaction(self, *, data: MovementRequest) -> tuple[TransactionCreate, list[PostingCreate]]:
        self._validate_fields(
            required_fields={"location_id": data.location_id, "destination_amount": data.destination_amount},
            forbidden_fields={"income_period": data.income_period},
        )
        self._validate_base_currency_amount_not_sent(data=data)

        accounts_db: dict[UUID, AccountModel] = await account_crud.get_locked_by_ids(
            db=self.db, ids=[data.from_account_id], user_id=self.user_id
        )
        from_account_db: AccountModel | None = accounts_db.get(data.from_account_id)
        await self._validate_transaction_from_account(data=data, from_account_db=from_account_db)

        await self._validate_counter_account(account_id=data.to_account_id, kind=AccountKind.EXPENSE)
        await location_service.get_location(db=self.db, location_id=data.location_id, user_id=self.user_id)

        base_amount: Decimal = ledger_service.get_debit_base_amount(
            currency=from_account_db.currency,
            balance=from_account_db.balance,
            base_balance=from_account_db.base_balance,
            amount=data.source_amount,
            base_currency=self.base_currency,
        )
        transaction_data: TransactionCreate = TransactionCreate(
            user_id=self.user_id,
            transaction_type=self._transaction_type,
            transaction_date=data.transaction_date,
            comment=data.comment,
            base_currency_amount=base_amount,
            location_id=data.location_id,
        )
        postings: list[PostingCreate] = self._get_postings(
            from_account_id=data.from_account_id,
            from_amount=data.source_amount,
            from_currency=data.source_currency,
            to_account_id=data.to_account_id,
            to_amount=data.destination_amount,
            to_currency=data.destination_currency,
            base_amount=base_amount,
        )
        return transaction_data, postings
