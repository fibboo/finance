from sqlalchemy import BigInteger, Column, String, DateTime, func

from app.db import Base


class ExpensePlace(Base):
    __tablename__ = 'expense_places'

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(64), nullable=False, unique=True)
    description = Column(String(256), nullable=True)
    status = Column(String(32), nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)
