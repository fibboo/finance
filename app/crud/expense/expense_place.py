from typing import Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import ExpensePlace
from app.schemas.expense.expense_place import ExpensePlaceCreate, ExpensePlaceUpdate, ExpensePlaceRequest


class CRUDExpensePlace(CRUDBase[ExpensePlace, ExpensePlaceCreate, ExpensePlaceUpdate]):
    def get_one_by_name(self, db: Session, name: str) -> Optional[ExpensePlace]:
        expense_place_db = db.query(self.model).filter_by(name=name).first()
        return expense_place_db

    def search(self, db: Session, request: ExpensePlaceRequest) -> list[ExpensePlace]:
        query = db.query(self.model)
        if request.name:
            query = query.filter(self.model.name.ilike(f'%{request.name}%'))
        if request.description:
            query = query.filter(self.model.description.ilike(f'%{request.description}%'))
        if request.statuses:
            query = query.filter(self.model.status.in_(request.statuses))

        query = query.order_by(self.model.name)
        expense_places_db = query.all()
        return expense_places_db


exp_place_crud = CRUDExpensePlace(ExpensePlace)
