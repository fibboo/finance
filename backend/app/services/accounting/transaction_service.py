from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.transaction import transaction_crud
from app.exceptions.not_fount_404 import EntityNotFound
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.transaction import Transaction as TransactionModel
from app.schemas.accounting.account import AdjustmentCreate, AdjustmentRequest
from app.schemas.accounting.posting import Posting
from app.schemas.accounting.transaction import MovementRequest, Transaction, TransactionRequest, TransactionType
from app.schemas.base import CurrencyCode
from app.services.accounting import exchange_rate_service
from app.services.accounting.transaction_processor import factory
from app.services.accounting.transaction_processor.base import TransactionProcessor

logger = get_logger(logger_name=__name__)


def _add_estimates(*, transactions: list[Transaction], base_currency_rates: dict[CurrencyCode, Decimal]) -> None:
    for transaction in transactions:
        if transaction.base_currency_amount is not None:
            continue

        debit: Posting = transaction.postings[0]
        debit_estimate: Decimal | None = exchange_rate_service.get_estimate(
            amount=debit.amount, currency=debit.currency, base_currency_rates=base_currency_rates
        )
        if debit_estimate is None:
            continue

        transaction.estimated_base_currency_amount = -debit_estimate
        for posting in transaction.postings:
            posting.estimated_base_amount = debit_estimate if posting.amount < 0 else -debit_estimate


async def get_transactions(*, db: AsyncSession, request: TransactionRequest, user_id: UUID) -> Page[Transaction]:
    transactions_db: Page[TransactionModel] = await transaction_crud.get_transactions(
        db=db, request=request, user_id=user_id
    )
    transactions = Page[Transaction].model_validate(transactions_db)
    has_unvalued: bool = any(transaction.base_currency_amount is None for transaction in transactions.items)
    if has_unvalued:
        base_currency_rates: dict[CurrencyCode, Decimal] = await exchange_rate_service.get_base_currency_rates(
            db=db, user_id=user_id
        )
        _add_estimates(transactions=transactions.items, base_currency_rates=base_currency_rates)

    return transactions


async def get_transaction(*, db: AsyncSession, transaction_id: UUID, user_id: UUID) -> Transaction:
    transaction_db: TransactionModel | None = await transaction_crud.get_or_none(
        db=db, id=transaction_id, user_id=user_id
    )

    if transaction_db is None:
        raise EntityNotFound(
            entity=TransactionModel, search_params={"id": transaction_id, "user_id": user_id}, logger=logger
        )

    transaction: Transaction = Transaction.model_validate(transaction_db)
    if transaction.base_currency_amount is None:
        base_currency_rates: dict[CurrencyCode, Decimal] = await exchange_rate_service.get_base_currency_rates(
            db=db, user_id=user_id
        )
        _add_estimates(transactions=[transaction], base_currency_rates=base_currency_rates)

    return transaction


async def _get_movement_processor(*, db: AsyncSession, data: MovementRequest, user_id: UUID) -> TransactionProcessor:
    from_account_db: AccountModel | None = await account_crud.get_or_none(
        db=db, id=data.from_account_id, user_id=user_id
    )
    if from_account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={"id": data.from_account_id}, logger=logger)

    to_account_db: AccountModel | None = await account_crud.get_or_none(db=db, id=data.to_account_id, user_id=user_id)
    if to_account_db is None:
        raise EntityNotFound(entity=AccountModel, search_params={"id": data.to_account_id}, logger=logger)

    transaction_processor: TransactionProcessor = factory.get_movement_processor(
        db=db, user_id=user_id, from_kind=from_account_db.kind, to_kind=to_account_db.kind
    )
    return transaction_processor


async def create_transaction(*, db: AsyncSession, create_data: MovementRequest, user_id: UUID) -> Transaction:
    transaction_processor: TransactionProcessor = await _get_movement_processor(
        db=db, data=create_data, user_id=user_id
    )
    transaction: Transaction = await transaction_processor.create(data=create_data)
    return transaction


async def update_transaction(
    *, db: AsyncSession, transaction_id: UUID, update_data: MovementRequest, user_id: UUID
) -> Transaction:
    transaction_processor: TransactionProcessor = await _get_movement_processor(
        db=db, data=update_data, user_id=user_id
    )
    transaction: Transaction = await transaction_processor.update(transaction_id=transaction_id, data=update_data)
    return transaction


async def adjust_balance(
    *, db: AsyncSession, account_id: UUID, adjustment_data: AdjustmentRequest, user_id: UUID
) -> Transaction:
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    create_data: AdjustmentCreate = AdjustmentCreate(**adjustment_data.model_dump(), account_id=account_id)
    transaction: Transaction = await transaction_processor.create(data=create_data)
    return transaction


async def update_adjustment(
    *, db: AsyncSession, account_id: UUID, transaction_id: UUID, adjustment_data: AdjustmentRequest, user_id: UUID
) -> Transaction:
    transaction_processor: TransactionProcessor = factory.get_processor(
        db=db, user_id=user_id, transaction_type=TransactionType.ADJUSTMENT
    )
    update_data: AdjustmentCreate = AdjustmentCreate(**adjustment_data.model_dump(), account_id=account_id)
    transaction: Transaction = await transaction_processor.update(transaction_id=transaction_id, data=update_data)
    return transaction
