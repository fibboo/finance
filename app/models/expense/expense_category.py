from sqlalchemy import UniqueConstraint, BigInteger, String, Column, DateTime, func

from app.db import Base


class ExpenseCategory(Base):
    __tablename__ = 'expense_categories'
    __table_args__ = (UniqueConstraint('type', 'name'),)

    id = Column(BigInteger, primary_key=True, index=True)
    type = Column(String(36), nullable=False)
    name = Column(String(64), nullable=False, unique=True)
    description = Column(String(256), nullable=True)
    status = Column(String(32), nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)
