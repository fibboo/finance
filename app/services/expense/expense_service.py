from decimal import Decimal
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.expense.expense import expense_crud
from app.exceptions.conflict_409 import IntegrityException
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.not_implemented_501 import NotImplementedException
from app.models.expense.expense import Expense as ExpenseModel
from app.schemas.base import CurrencyType, EntityStatusType
from app.schemas.expense.expense import Expense, ExpenseCreate, ExpenseRequest, ExpenseUpdate
from app.services.user import user_service

logger = get_logger(__name__)


async def create_expense(db: AsyncSession, expense_create: ExpenseCreate, user_id: UUID) -> Expense:
    base_currency: CurrencyType = await user_service.get_user_base_currency(db=db, user_id=user_id)
    amount: Decimal = _get_currency_amount(expense_amount=expense_create.original_amount,
                                           expense_currency=expense_create.original_currency,
                                           base_currency=base_currency)
    obj_in: ExpenseModel = ExpenseModel(**expense_create.model_dump(),
                                        amount=amount,
                                        user_id=user_id,
                                        status=EntityStatusType.ACTIVE)
    try:
        expense_db: ExpenseModel = await expense_crud.create(db=db, obj_in=obj_in)
    except IntegrityError as exc:
        raise IntegrityException(entity=ExpenseModel, exception=exc, logger=logger)

    expense: Expense = Expense.model_validate(expense_db)
    return expense


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


async def get_expenses(db: AsyncSession, request: ExpenseRequest, user_id: UUID) -> Page[Expense]:
    expenses_db: Page[ExpenseModel] = await expense_crud.get_expenses(db=db, request=request, user_id=user_id)
    expenses = Page[Expense].model_validate(expenses_db)
    return expenses


async def get_expense_by_id(db: AsyncSession, expense_id: UUID, user_id: UUID) -> Expense:
    expense_db: ExpenseModel | None = await expense_crud.get_or_none(db=db, id=expense_id, user_id=user_id)

    if expense_db is None:
        raise EntityNotFound(entity=ExpenseModel, search_params={'id': expense_id, 'user_id': user_id}, logger=logger)

    expense: Expense = Expense.model_validate(expense_db)
    return expense


async def update_expense(db: AsyncSession, expense_id: UUID, expense_update: ExpenseUpdate, user_id: UUID) -> Expense:
    base_currency: CurrencyType = await user_service.get_user_base_currency(db=db, user_id=user_id)
    amount: Decimal = _get_currency_amount(expense_amount=expense_update.original_amount,
                                           expense_currency=expense_update.original_currency,
                                           base_currency=base_currency)
    expense_update_model: ExpenseModel = ExpenseModel(**expense_update.model_dump(),
                                                      amount=amount,
                                                      user_id=user_id,
                                                      status=EntityStatusType.ACTIVE)
    try:
        expense_db: ExpenseModel | None = await expense_crud.update(db=db,
                                                                    id=expense_id,
                                                                    obj_in=expense_update_model,
                                                                    user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=ExpenseModel, exception=exc, logger=logger)

    if expense_db is None:
        raise EntityNotFound(entity=ExpenseModel, search_params={'id': expense_id, 'user_id': user_id}, logger=logger)

    expense: Expense = Expense.model_validate(expense_db)
    return expense


async def delete_expense(db: AsyncSession, expense_id: UUID, user_id: UUID) -> None:
    delete_update_data = {'status': EntityStatusType.DELETED}

    try:
        expense_db: ExpenseModel | None = await expense_crud.update(db=db,
                                                                    id=expense_id,
                                                                    obj_in=delete_update_data,
                                                                    user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityException(entity=ExpenseModel, exception=exc, logger=logger)

    if expense_db is None:
        raise EntityNotFound(entity=ExpenseModel, search_params={'id': expense_id, 'user_id': user_id}, logger=logger)
