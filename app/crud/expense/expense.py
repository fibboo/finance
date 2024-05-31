from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import select, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.expense.expense import Expense
from app.schemas.expense.expense import ExpenseCreate, ExpenseUpdate, ExpenseRequest, OrderDirectionType, OrderFieldType


class CRUDExpense(CRUDBase[Expense, ExpenseCreate, ExpenseUpdate]):
    async def get_expenses(self, db: AsyncSession, request: ExpenseRequest, user_id: UUID) -> Page[Expense]:
        query = select(self.model).where(self.model.user_id == user_id)

        if request.amount_from is not None:
            query = query.where(self.model.amount >= request.amount_from)

        if request.amount_to is not None:
            query = query.where(self.model.amount <= request.amount_to)

        if request.original_amount_from is not None:
            query = query.where(self.model.original_amount >= request.original_amount_from)

        if request.original_amount_to is not None:
            query = query.where(self.model.original_amount <= request.original_amount_to)

        if len(request.original_currencies) > 0:
            currencies = [c for c in request.original_currencies]
            query = query.where(self.model.original_currency.in_(currencies))

        if request.date_from is not None:
            query = query.where(self.model.expense_date >= request.date_from)

        if request.date_to is not None:
            query = query.where(self.model.expense_date <= request.date_to)

        if len(request.category_ids) > 0:
            query = query.where(self.model.category_id.in_(request.category_ids))

        if len(request.location_ids) > 0:
            query = query.where(self.model.location_id.in_(request.location_ids))

        if len(request.statuses) > 0:
            statuses = [s.value for s in request.statuses]
            query = query.where(self.model.status.in_(statuses))

        order_fields_map = {OrderFieldType.CREATED_AT: self.model.created_at,
                            OrderFieldType.EXPENSE_DATE: self.model.expense_date,
                            OrderFieldType.AMOUNT: self.model.amount}
        for order in request.orders:
            func_ordering = desc if order.ordering == OrderDirectionType.DESC else asc
            query = query.order_by(func_ordering(order_fields_map[order.field]))

        query = query.order_by(self.model.id)

        paginated_expenses = await paginate(db, query, request)
        return paginated_expenses


expense_crud = CRUDExpense(Expense)
