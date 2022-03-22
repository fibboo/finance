from sqlalchemy import Column, String, BigInteger, Numeric, ForeignKey, Date, func, DateTime
from sqlalchemy.orm import relationship

from app.db import Base


class Expense(Base):
    __tablename__ = 'expenses'

    id = Column(BigInteger, primary_key=True, index=True)
    category_id = Column(ForeignKey('expense_categories.id'), nullable=False)
    place_id = Column(ForeignKey('expense_places.id'), nullable=False)

    date = Column(Date, nullable=False)
    amount = Column(Numeric, nullable=False)
    comment = Column(String(256), nullable=True)

    category = relationship('ExpenseCategory', lazy='joined')
    place = relationship('ExpensePlace', lazy='joined')

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)
