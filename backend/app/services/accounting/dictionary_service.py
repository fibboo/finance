from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.accounting.currency import currency_crud
from app.models.accounting.currency import Currency as CurrencyModel
from app.schemas.accounting.account import ACCOUNT_KIND_LABELS, AccountKind, CATEGORY_TYPE_LABELS, CategoryType
from app.schemas.accounting.dictionary import AccountingDictionaries
from app.schemas.accounting.transaction import TRANSACTION_ORDER_LABELS, TRANSACTION_TYPE_LABELS, TransactionType
from app.schemas.dictionary import DictionaryItem


async def get_accounting_dictionaries(*, db: AsyncSession) -> AccountingDictionaries:
    currencies_db: list[CurrencyModel] = await currency_crud.get_currencies(db=db)
    currencies: list[DictionaryItem] = []
    for currency_db in currencies_db:
        currencies.append(DictionaryItem(key=currency_db.code, label=currency_db.name))

    account_kinds: list[DictionaryItem] = []
    for account_kind in AccountKind:
        account_kinds.append(DictionaryItem(key=account_kind.value, label=ACCOUNT_KIND_LABELS[account_kind]))

    category_types: list[DictionaryItem] = []
    for category_type in CategoryType:
        category_types.append(DictionaryItem(key=category_type.value, label=CATEGORY_TYPE_LABELS[category_type]))

    transaction_types: list[DictionaryItem] = []
    for transaction_type in TransactionType:
        transaction_types.append(
            DictionaryItem(key=transaction_type.value, label=TRANSACTION_TYPE_LABELS[transaction_type])
        )

    transaction_orders: list[DictionaryItem] = []
    for order, label in TRANSACTION_ORDER_LABELS.items():
        transaction_orders.append(DictionaryItem(key=order, label=label))

    dictionaries = AccountingDictionaries(
        currencies=currencies,
        account_kinds=account_kinds,
        category_types=category_types,
        transaction_types=transaction_types,
        transaction_orders=transaction_orders,
    )
    return dictionaries
