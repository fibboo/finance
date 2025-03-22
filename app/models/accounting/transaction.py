from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, DateTime, Enum, ForeignKey, func, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.accounting.account import Account
from app.models.accounting.category import Category
from app.models.accounting.income_source import IncomeSource
from app.models.accounting.location import Location
from app.models.base import Base
from app.schemas.accounting.transaction import TransactionType
from app.schemas.base import CurrencyType, EntityStatusType


class Transaction(Base):
    __tablename__ = 'transactions'

    """
    source_amount — amount in the withdrawal currency
    source_currency — withdrawal currency
    destination_amount — amount in the receiving currency
    destination_currency — receiving currency
    base_currency_amount — amount in the user base currency

    For income: source_* refers to the incoming amount in the original currency, destination_* refers to the credited amount in the receiving account
    For expenses: source_* refers to the amount withdrawn from the account, destination_* refers to the amount in the seller's/recipient's currency
    For transfers: source_* refers to the withdrawal from one account, destination_* refers to the deposit to another account
    """

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=text('gen_random_uuid()'))  # noqa: A003
    user_id: Mapped[UUID] = mapped_column(DB_UUID, nullable=False, index=True)

    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    base_currency_amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False, index=True)

    source_amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False, index=True)
    source_currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType,
                                                               native_enum=False,
                                                               validate_strings=True,
                                                               values_callable=lambda x: [i.value for i in x]),
                                                          nullable=False)
    destination_amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    destination_currency: Mapped[CurrencyType] = mapped_column(Enum(CurrencyType,
                                                                    native_enum=False,
                                                                    validate_strings=True,
                                                                    values_callable=lambda x: [i.value for i in x]),
                                                               nullable=False)

    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType,
                                                                   native_enum=False,
                                                                   validate_strings=True,
                                                                   values_callable=lambda x: [i.value for i in x]),
                                                              nullable=False, index=True)

    status: Mapped[EntityStatusType] = mapped_column(Enum(EntityStatusType,
                                                          native_enum=False,
                                                          validate_strings=True,
                                                          values_callable=lambda x: [i.value for i in x]),
                                                     nullable=False,
                                                     server_default=EntityStatusType.ACTIVE.value,
                                                     index=True)
    comment: Mapped[str | None] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(),
                                                 nullable=False)

    __mapper_args__ = {'polymorphic_on': transaction_type,
                       'polymorphic_load': 'joined'}

    def __init__(self, *args, **kwargs):
        if self.__class__ is Transaction:
            raise TypeError('Cannot instantiate abstract class Transaction.')
        super().__init__(*args, **kwargs)

    def __repr__(self):
        return f'<{self.transaction_type} transaction (id={self.id}, base_currency_amount={self.base_currency_amount})>'


class ExpenseTransaction(Transaction):
    __tablename__ = 'transactions_expense'

    id: Mapped[UUID] = mapped_column(ForeignKey(Transaction.id), primary_key=True)  # noqa: A003
    from_account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=False, index=True)
    category_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Category.id), nullable=False, index=True)
    location_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Location.id), nullable=False, index=True)

    from_account: Mapped[Account] = relationship(Account, foreign_keys=[from_account_id], lazy='joined')
    category: Mapped[Category] = relationship(Category, foreign_keys=[category_id], lazy='joined')
    location: Mapped[Location] = relationship(Location, foreign_keys=[location_id], lazy='joined')

    __mapper_args__ = {'polymorphic_identity': TransactionType.EXPENSE.value}

    def __repr__(self):
        return (f'<Expense transaction (id={self.id}, base_currency_amount={self.base_currency_amount}), '
                f'category={self.category}, location={self.location})>')


class IncomeTransaction(Transaction):
    __tablename__ = 'transactions_income'

    id: Mapped[UUID] = mapped_column(ForeignKey(Transaction.id), primary_key=True)  # noqa: A003
    income_source_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(IncomeSource.id), nullable=False, index=True)
    to_account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=False, index=True)

    income_source: Mapped[IncomeSource] = relationship(IncomeSource, foreign_keys=[income_source_id], lazy='joined')
    to_account: Mapped[Account] = relationship(Account, foreign_keys=[to_account_id], lazy='joined')

    __mapper_args__ = {'polymorphic_identity': TransactionType.INCOME.value}

    def __repr__(self):
        return (f'Income transaction (id={self.id}, base_currency_amount={self.base_currency_amount}), '
                f'income_source={self.income_source}')


class TransferTransaction(Transaction):
    __tablename__ = 'transactions_transfer'

    id: Mapped[UUID] = mapped_column(ForeignKey(Transaction.id), primary_key=True)  # noqa: A003
    from_account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=False, index=True)
    to_account_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey(Account.id), nullable=False, index=True)

    from_account: Mapped[Account] = relationship(Account, foreign_keys=[from_account_id], lazy='joined')
    to_account: Mapped[Account] = relationship(Account, foreign_keys=[to_account_id], lazy='joined')

    __mapper_args__ = {'polymorphic_identity': TransactionType.TRANSFER.value}

    def __repr__(self):
        return (f'Transfer transaction (id={self.id}, base_currency_amount={self.base_currency_amount}), '
                f'from_account={self.from_account}, to_account={self.to_account})')
