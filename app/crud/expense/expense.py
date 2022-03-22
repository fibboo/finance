from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.expense.expense import Expense
from app.schemas.expense.expense import ExpenseCreate, ExpenseUpdate, ExpenseRequest


class CRUDExpense(CRUDBase[Expense, ExpenseCreate, ExpenseUpdate]):
    def get_expenses(self, db: Session, request: ExpenseRequest, limit: int = 500) -> list[Expense]:
        query = db.query(self.model).filter(self.model.date.between(request.date_from, request.date_to))

        if request.category_ids:
            query = query.filter(self.model.category_id.in_(request.category_ids))

        if request.place_ids:
            query = query.filter(self.model.place_id.in_(request.place_ids))

        if request.amount_to:
            query = query.filter(self.model.amount.between(request.amount_from, request.amount_to))

        query = query.order_by(self.model.date.desc(), self.model.id.desc()).limit(limit)
        expenses_db = query.all()
        return expenses_db


expense_crud = CRUDExpense(Expense)
