from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.currency import currency_crud
from app.models.accounting.currency import Currency as CurrencyModel
from app.schemas.accounting.account import CATEGORY_PURPOSE_LABELS, CategoryPurpose
from app.schemas.accounting.dictionary import AccountingDictionaries
from app.schemas.accounting.transaction import TRANSACTION_ORDER_LABELS, TRANSACTION_TYPE_LABELS, TransactionType
from app.schemas.dictionary import DictionaryItem


async def get_accounting_dictionaries(*, db: AsyncSession) -> AccountingDictionaries:
    currencies_db: list[CurrencyModel] = await currency_crud.get_currencies(db=db)
    currencies: list[DictionaryItem] = []
    for currency_db in currencies_db:
        currencies.append(DictionaryItem(key=currency_db.code, label=currency_db.name))

    transaction_types: list[DictionaryItem] = []
    for transaction_type in TransactionType:
        transaction_types.append(
            DictionaryItem(key=transaction_type.value, label=TRANSACTION_TYPE_LABELS[transaction_type])
        )

    transaction_orders: list[DictionaryItem] = []
    for order, label in TRANSACTION_ORDER_LABELS.items():
        transaction_orders.append(DictionaryItem(key=order, label=label))

    category_purposes: list[DictionaryItem] = []
    for purpose in CategoryPurpose:
        category_purposes.append(DictionaryItem(key=purpose.value, label=CATEGORY_PURPOSE_LABELS[purpose]))

    dictionaries = AccountingDictionaries(
        currencies=currencies,
        category_purposes=category_purposes,
        transaction_types=transaction_types,
        transaction_orders=transaction_orders,
    )
    return dictionaries
