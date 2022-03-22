from typing import Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import ExpenseCategory
from app.schemas.expense.expense_category import (ExpenseCategoryCreate, ExpenseCategoryUpdate, ExpenseType,
                                                  ExpenseCategoryRequest)


class CRUDExpenseCategory(CRUDBase[ExpenseCategory, ExpenseCategoryCreate, ExpenseCategoryUpdate]):
    def get_one_by_type_and_name(self, db: Session, type: ExpenseType, name: str) -> Optional[ExpenseCategory]:
        expense_category_db = db.query(self.model).filter(self.model.type == type, self.model.name == name).first()
        return expense_category_db

    def search(self, db: Session, request: ExpenseCategoryRequest) -> list[ExpenseCategory]:
        query = db.query(self.model)
        if request.name:
            query = query.filter(self.model.name.ilike(f'%{request.name}%'))
        if request.description:
            query = query.filter(self.model.description.ilike(f'%{request.description}%'))
        if request.types:
            query = query.filter(self.model.type.in_(request.types))
        if request.statuses:
            query = query.filter(self.model.status.in_(request.statuses))

        query = query.order_by(self.model.name)
        expense_categories_db = query.all()
        return expense_categories_db


exp_category_crud = CRUDExpenseCategory(ExpenseCategory)
