from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi_pagination import Page
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.expense.expense import expense_crud
from app.exceptions.exception import NotFoundEntity, IntegrityExistException, ProcessingException
from app.models import Expense as ExpenseModel
from app.schemas.base import EntityStatusType, CurrencyType
from app.schemas.expense.expense import ExpenseCreate, Expense, ExpenseUpdate, ExpenseRequest
from app.services.user import user_service


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
        raise IntegrityExistException(model=ExpenseModel, exception=exc)

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
            raise ProcessingException(f'Currency {expense_currency} is not supported.')


async def get_expenses(db: AsyncSession, request: ExpenseRequest, user_id: UUID) -> Page[Expense]:
    expenses_db: Page[ExpenseModel] = await expense_crud.get_expenses(db=db, request=request, user_id=user_id)
    expenses = Page[Expense].model_validate(expenses_db)
    return expenses


async def get_expense_by_id(db: AsyncSession, expense_id: UUID, user_id: UUID) -> Expense:
    expense_db: Optional[ExpenseModel] = await expense_crud.get(db=db, id=expense_id, user_id=user_id)

    if expense_db is None:
        raise NotFoundEntity(f'Expense not found by user_id #{user_id} and expense_id #{expense_id}.')

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
        expense_db: Optional[ExpenseModel] = await expense_crud.update(db=db,
                                                                       id=expense_id,
                                                                       obj_in=expense_update_model,
                                                                       user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityExistException(model=ExpenseModel, exception=exc)

    if expense_db is None:
        raise NotFoundEntity(f'Expense not found by user_id #{user_id} and expense_id #{expense_id}')

    expense: Expense = Expense.model_validate(expense_db)
    return expense


async def delete_expense(db: AsyncSession, expense_id: UUID, user_id: UUID) -> None:
    delete_update_data = {'status': EntityStatusType.DELETED}
    try:
        expense_db: Optional[ExpenseModel] = await expense_crud.update(db=db,
                                                                       id=expense_id,
                                                                       obj_in=delete_update_data,
                                                                       user_id=user_id)
    except IntegrityError as exc:
        raise IntegrityExistException(model=ExpenseModel, exception=exc)

    if expense_db is None:
        raise NotFoundEntity(f'Expense not found by user_id #{user_id} and expense_id #{expense_id}')
