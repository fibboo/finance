from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.transaction.transaction import transaction_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.transaction.transaction import Transaction as ExpenseModel
from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.transaction.transaction import Transaction, TransactionCreate, TransactionRequest, TransactionUpdate
from app.services.user import user_service

logger = get_logger(__name__)


def _get_currency_amount(expense_amount: Decimal,
                         expense_currency: CurrencyType,
                         base_currency: CurrencyType) -> Decimal:
    match expense_currency:
        case CurrencyType.USD:
            return expense_amount
        case CurrencyType.GEL:
            return round(expense_amount / Decimal('2.6'), 2)
        case CurrencyType.TRY:
            return round(expense_amount / Decimal('30'), 2)
        case CurrencyType.RUB:
            return round(expense_amount / Decimal('95'), 2)
        case _:
            raise NotImplementedException(log_message=f'Currency {expense_currency} is not supported.', logger=logger)


async def spend(db: AsyncSession, expense_create: TransactionCreate, user_id: UUID) -> Transaction:
    base_currency: CurrencyType = await user_service.get_user_base_currency(db=db, user_id=user_id)
    amount: Decimal = _get_currency_amount(expense_amount=expense_create.amount,
                                           expense_currency=expense_create.currency,
                                           base_currency=base_currency)
    obj_in: ExpenseModel = ExpenseModel(**expense_create.model_dump(),
                                        amount=amount,
                                        user_id=user_id,
                                        status=EntityStatusType.ACTIVE)
    try:
        expense_db: ExpenseModel = await transaction_crud.create(db=db, obj_in=obj_in)

    except IntegrityError as exc:
        raise IntegrityException(entity=ExpenseModel, exception=exc, logger=logger)

    expense: Transaction = Transaction.model_validate(expense_db)
    return expense


async def get_expenses(db: AsyncSession, request: TransactionRequest, user_id: UUID) -> Page[Transaction]:
    expenses_db: Page[ExpenseModel] = await transaction_crud.get_expenses(db=db, request=request, user_id=user_id)
    expenses = Page[Transaction].model_validate(expenses_db)
    return expenses


async def get_expense_by_id(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> Transaction:
    expense_db: ExpenseModel | None = await transaction_crud.get_or_none(db=db, id=transaction_id, user_id=user_id)

    if expense_db is None:
        raise EntityNotFound(entity=ExpenseModel, search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    expense: Transaction = Transaction.model_validate(expense_db)
    return expense


async def update_expense(db: AsyncSession, transaction_id: UUID, transaction_update: TransactionUpdate,
                         user_id: UUID) -> Transaction:
    base_currency: CurrencyType = await user_service.get_user_base_currency(db=db, user_id=user_id)
    amount: Decimal = _get_currency_amount(expense_amount=transaction_update.amount,
                                           expense_currency=transaction_update.currency,
                                           base_currency=base_currency)
    expense_update_model: ExpenseModel = ExpenseModel(**transaction_update.model_dump(),
                                                      amount=amount,
                                                      user_id=user_id,
                                                      status=EntityStatusType.ACTIVE)
    try:
        expense_db: ExpenseModel | None = await transaction_crud.update(db=db,
                                                                        id=transaction_id,
                                                                        obj_in=expense_update_model,
                                                                        user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=ExpenseModel, exception=exc, logger=logger)

    if expense_db is None:
        raise EntityNotFound(entity=ExpenseModel, search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)

    expense: Transaction = Transaction.model_validate(expense_db)
    return expense


async def delete_expense(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> None:
    delete_update_data = {'status': EntityStatusType.DELETED}

    try:
        expense_db: ExpenseModel | None = await transaction_crud.update(db=db,
                                                                        id=transaction_id,
                                                                        obj_in=delete_update_data,
                                                                        user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=ExpenseModel, exception=exc, logger=logger)

    if expense_db is None:
        raise EntityNotFound(entity=ExpenseModel, search_params={'id': transaction_id, 'user_id': user_id},
                             logger=logger)
