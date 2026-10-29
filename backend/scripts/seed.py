import asyncio
import math
import random
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, func, Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.user.authorization_request import authorization_request_crud
from app.crud.user.refresh_token import refresh_token_crud
from app.crud.user.user import user_crud
from app.db.postgres import session_maker
from app.models.accounting.account import Account as AccountModel
from app.models.accounting.location import Location as LocationModel
from app.models.accounting.posting import Posting
from app.models.accounting.transaction import Transaction
from app.models.user.external_user import ExternalUser
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import Account, AccountCreateRequest, AccountKind, AdjustmentRequest, CategoryType
from app.schemas.accounting.location import Location, LocationCreateRequest
from app.schemas.accounting.transaction import MovementRequest
from app.schemas.user.external_user import ProviderType
from app.schemas.user.identity import ProviderIdentity
from app.schemas.user.user import USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH
from app.services.accounting import account_service, location_service, transaction_service
from app.services.user import user_service

logger = get_logger(logger_name=__name__)

DEFAULT_USERNAME = "test_1"
BASE_CURRENCY = "USD"
RECREATE_ANSWER = "r"
RANDOM_SEED = 20261026
HISTORY_START = date(2024, 1, 1)
CREDIT_PERIOD = timedelta(days=90)
RSD_PER_USD = 100
RSD_PER_EUR = 117
GEL_PER_EUR = 2.95
USD_PER_EUR = 1.17
PROGRESS_STEP = 500

EXTRA_ACCOUNTS: list[AccountCreateRequest] = [
    AccountCreateRequest(name="Main card", kind=AccountKind.ASSET, currency="EUR", color="#5B6CD9"),
    AccountCreateRequest(name="Savings", kind=AccountKind.ASSET, currency="GEL", color="#2E8C7A"),
    AccountCreateRequest(name="Freelance", kind=AccountKind.ASSET, currency="USD", color="#A15CB8"),
    AccountCreateRequest(name="Credit card", kind=AccountKind.LIABILITY, currency="USD", color="#C2563A"),
    AccountCreateRequest(name="Dinar card", kind=AccountKind.ASSET, currency="RSD", color="#D9A441"),
    AccountCreateRequest(name="Intesa credit", kind=AccountKind.LIABILITY, currency="EUR", color="#7A4FC2"),
    AccountCreateRequest(name="Salary", kind=AccountKind.INCOME),
    AccountCreateRequest(name="Freelance projects", kind=AccountKind.INCOME),
    AccountCreateRequest(name="Household", kind=AccountKind.EXPENSE, category_type=CategoryType.VARIABLE),
    AccountCreateRequest(name="Pets", kind=AccountKind.EXPENSE, category_type=CategoryType.VARIABLE),
]

SPENDING = [
    (
        "Groceries",
        [
            ("Lidl", "Lidl"),
            ("Univerexport", "Univerexport"),
            ("Maxi", "Maxi"),
            ("Univerexport", "Univerexport. Kafa i čaj"),
            ("Lidl", "Lidl. Sok"),
            (None, "voda"),
            (None, "Prva ruska kuhinja"),
            ("Maxi", "Maxi. Hleb"),
        ],
        150,
        10000,
        38,
    ),
    ("Eating out", [("Corner cafe", "Corner cafe"), (None, "Kafana"), (None, "Burek"), (None, "Pizza")], 300, 4000, 11),
    (
        "Household",
        [
            ("DM drogerie", "DM drogerie"),
            (None, "Fix Price"),
            (None, "Elephant"),
            ("DM drogerie", "DM. Soap and dish rinse"),
        ],
        150,
        3500,
        13,
    ),
    ("Pets", [("Premium Pet", "Premium Pet"), ("Premium Pet", "Premium Pet. Food"), (None, "Vet")], 50, 2600, 7),
    ("Transport", [(None, "Bus ticket"), (None, "Taxi"), (None, "Car Go")], 100, 1500, 9),
    ("Health", [("Pharmacy", "Pharmacy"), ("DM drogerie", "DM. Melatonin"), (None, "Dentist")], 300, 6000, 5),
    ("Clothing", [(None, "Zara"), (None, "Shoes"), (None, "H&M")], 1500, 14000, 2),
]
EXTRA_LOCATIONS = ["Infostan", "Abroad", "Online", "Airport", "Metro"]
DAY_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]
DAY_WEIGHTS = [24, 19, 16, 12, 9, 6, 5, 3, 2, 2, 1, 1]
SUBSCRIPTIONS = [(3, "Netflix", 11.99), (12, "Spotify", 6.99), (20, "Racknerd server", 10.98)]
CREDIT_PURCHASES = [
    ("Clothing", "Zara", 4500, 16000),
    ("Household", "Elephant", 1500, 9000),
    ("Eating out", "Kafana", 1200, 5000),
    ("Health", "Dentist", 6000, 24000),
    ("Groceries", "Maxi", 2500, 9000),
]
OPENING_BALANCES = [
    ("Main card", Decimal("4000.00"), Decimal("4680.00")),
    ("Dinar card", Decimal("40000.00"), Decimal("400.00")),
    ("Wallet", Decimal("300.00"), None),
    ("Savings", Decimal("1500.00"), Decimal("595.00")),
    ("Freelance", Decimal("500.00"), None),
]


def _money(*, value: float) -> Decimal:
    money: Decimal = Decimal(f"{value:.2f}")
    return money


def _log_uniform(*, generator: random.Random, low: float, high: float) -> float:
    value: float = math.exp(generator.uniform(math.log(low), math.log(high)))
    return value


def _location_names() -> list[str]:
    names: set[str] = set(EXTRA_LOCATIONS)
    for _category, places, *_rest in SPENDING:
        for location, comment in places:
            names.add(location if location is not None else comment.split(".")[0])

    for _category, location, *_rest in CREDIT_PURCHASES:
        names.add(location)

    location_names: list[str] = sorted(names)
    return location_names


async def _count_user_entities(*, db: AsyncSession, user_id: UUID) -> dict[str, int]:
    counts: dict[str, int] = {}
    for name, model in [("accounts", AccountModel), ("locations", LocationModel), ("transactions", Transaction)]:
        counts[name] = await db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id))

    return counts


async def _delete_user(*, db: AsyncSession, user_id: UUID) -> None:
    transaction_ids: Select = select(Transaction.id).where(Transaction.user_id == user_id)
    await db.execute(delete(Posting).where(Posting.transaction_id.in_(transaction_ids)))
    await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    await db.execute(delete(AccountModel).where(AccountModel.user_id == user_id))
    await db.execute(delete(LocationModel).where(LocationModel.user_id == user_id))
    await db.execute(delete(ExternalUser).where(ExternalUser.user_id == user_id))
    await refresh_token_crud.delete_by_user(db=db, user_id=user_id)
    await authorization_request_crud.delete_by_user(db=db, user_id=user_id)
    await user_crud.delete_by_id(db=db, user_id=user_id)


async def _create_user(*, db: AsyncSession, username: str) -> UserModel:
    identity = ProviderIdentity(
        provider=ProviderType.TELEGRAM,
        external_id=username,
        username=username,
        first_name=None,
        last_name=None,
        avatar=None,
        email=None,
    )
    user_db: UserModel | None = await user_service.create_user(db=db, identity=identity)
    if user_db is None:
        raise SystemExit(f"No free username for {username}")

    await user_service.set_base_currency(db=db, user_id=user_db.id, base_currency=BASE_CURRENCY)
    return user_db


def _plan_history(
    *, accounts: dict[str, UUID], locations: dict[str, UUID], today: date, generator: random.Random
) -> list[MovementRequest]:
    moves: list[MovementRequest] = []

    def move(
        *,
        day: date,
        source: str,
        target: str,
        amount: float,
        currency: str,
        destination_amount: float | None = None,
        destination_currency: str | None = None,
        location: str | None = None,
        **fields: object,
    ) -> None:
        destination_currency = destination_currency if destination_currency is not None else currency
        is_destination_amount_derived: bool = destination_currency != currency and destination_currency == BASE_CURRENCY
        destination_amount = amount if destination_amount is None else destination_amount
        request = MovementRequest(
            transaction_date=day,
            from_account_id=accounts[source],
            to_account_id=accounts[target],
            source_amount=_money(value=amount),
            source_currency=currency,
            destination_amount=None if is_destination_amount_derived else _money(value=destination_amount),
            destination_currency=destination_currency,
            location_id=None if location is None else locations[location],
            **fields,
        )
        moves.append(request)

    month: date = HISTORY_START
    while month <= today:
        next_month: date = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
        payday: date = month + timedelta(days=generator.randint(0, 3))
        dinar_spent: float = 0.0
        card_spent_usd: float = 0.0

        day: date = month
        while day < next_month and day <= today:
            for _ in range(generator.choices(DAY_COUNTS, weights=DAY_WEIGHTS)[0]):
                category, places, low, high, _weight = generator.choices(
                    SPENDING, weights=[item[4] for item in SPENDING]
                )[0]
                location, comment = generator.choice(places)
                location = location if location is not None else comment.split(".")[0]
                rsd: float = _log_uniform(generator=generator, low=low, high=high)
                payment: float = generator.random()
                if payment < 0.78:
                    move(
                        day=day,
                        source="Dinar card",
                        target=category,
                        amount=rsd,
                        currency="RSD",
                        location=location,
                        comment=comment,
                    )
                    dinar_spent += rsd
                elif payment < 0.92 or category in ("Transport", "Eating out"):
                    usd: float = rsd / RSD_PER_USD
                    move(
                        day=day,
                        source="Credit card",
                        target=category,
                        amount=usd,
                        currency="USD",
                        destination_amount=rsd,
                        destination_currency="RSD",
                        location=location,
                        comment=comment,
                    )
                    card_spent_usd += usd
                else:
                    move(
                        day=day,
                        source="Wallet",
                        target=category,
                        amount=rsd / RSD_PER_USD,
                        currency="USD",
                        location=location,
                        comment=comment,
                    )

            day += timedelta(days=1)

        for day_of_month, name, usd in SUBSCRIPTIONS:
            day = month.replace(day=day_of_month)
            if day <= today:
                move(
                    day=day,
                    source="Credit card",
                    target="Subscriptions",
                    amount=usd,
                    currency="USD",
                    location="Online",
                    comment=name,
                )
                card_spent_usd += usd

        utilities_day: date = month.replace(day=generator.randint(10, 18))
        if utilities_day <= today:
            utilities: float = generator.uniform(7000, 13000)
            move(
                day=utilities_day,
                source="Dinar card",
                target="Utilities",
                amount=utilities,
                currency="RSD",
                location="Infostan",
                comment="Infostan",
            )
            dinar_spent += utilities

        trip_start: date = month.replace(day=12)
        if month.month in (4, 8) and trip_start <= today:
            for offset in range(generator.randint(4, 8)):
                eur: float = _log_uniform(generator=generator, low=15, high=260)
                move(
                    day=min(trip_start + timedelta(days=offset), today),
                    source="Credit card",
                    target="Travel",
                    amount=eur * USD_PER_EUR,
                    currency="USD",
                    destination_amount=eur,
                    destination_currency="EUR",
                    location="Airport" if offset == 0 else "Abroad",
                    comment="Trip",
                )
                card_spent_usd += eur * USD_PER_EUR

        if payday <= today:
            salary: float = generator.uniform(3150, 3350)
            move(
                day=payday,
                source="Salary",
                target="Main card",
                amount=salary,
                currency="EUR",
                base_currency_amount=_money(value=salary * USD_PER_EUR),
                income_period=month,
                comment="Salary",
            )
            if dinar_spent > 0:
                parts: list[float] = generator.choice([[1.0], [0.6, 0.4], [0.5, 0.3, 0.2]])
                transfer_days: list[date] = sorted(payday + timedelta(days=generator.randint(0, 6)) for _ in parts)
                for share, transfer_day in zip(parts, transfer_days):
                    eur: float = dinar_spent * 1.04 * share / RSD_PER_EUR
                    move(
                        day=min(transfer_day, today),
                        source="Main card",
                        target="Dinar card",
                        amount=eur,
                        currency="EUR",
                        destination_amount=eur * RSD_PER_EUR * generator.uniform(0.997, 1.0),
                        destination_currency="RSD",
                    )

            if card_spent_usd > 0:
                move(
                    day=min(payday + timedelta(days=generator.randint(1, 5)), today),
                    source="Main card",
                    target="Credit card",
                    amount=card_spent_usd / USD_PER_EUR,
                    currency="EUR",
                    destination_amount=card_spent_usd,
                    destination_currency="USD",
                    comment="Card payoff",
                )

            move(
                day=min(payday + timedelta(days=generator.randint(0, 3)), today),
                source="Main card",
                target="Savings",
                amount=400,
                currency="EUR",
                destination_amount=400 * GEL_PER_EUR * generator.uniform(0.99, 1.01),
                destination_currency="GEL",
            )
            if generator.random() < 0.6:
                move(
                    day=min(payday + timedelta(days=generator.randint(1, 6)), today),
                    source="Main card",
                    target="Wallet",
                    amount=150,
                    currency="EUR",
                    destination_amount=150 * USD_PER_EUR,
                    destination_currency="USD",
                    comment="ATM",
                )

        invoice_day: date = month.replace(day=15)
        if month.month % 2 == 0 and invoice_day <= today:
            move(
                day=invoice_day,
                source="Freelance projects",
                target="Freelance",
                amount=generator.uniform(500, 1400),
                currency="USD",
                income_period=month,
                comment="Client invoice",
            )
            withdrawal_day: date = month.replace(day=17)
            if generator.random() < 0.5 and withdrawal_day <= today:
                move(day=withdrawal_day, source="Freelance", target="Wallet", amount=200, currency="USD")

        month = next_month

    day: date = today - CREDIT_PERIOD
    while day <= today:
        category, location, low, high = generator.choice(CREDIT_PURCHASES)
        rsd: float = generator.uniform(low, high)
        move(
            day=day,
            source="Intesa credit",
            target=category,
            amount=rsd / RSD_PER_EUR,
            currency="EUR",
            destination_amount=rsd,
            destination_currency="RSD",
            location=location,
            comment=location,
        )
        day += timedelta(days=generator.randint(2, 6))

    moves.sort(key=lambda request: request.transaction_date)
    return moves


async def seed(*, db: AsyncSession) -> None:
    username: str = DEFAULT_USERNAME
    user_db: UserModel | None = await user_crud.get_user_by_external_id(
        db=db, external_id=username, provider=ProviderType.TELEGRAM
    )
    while user_db is not None:
        counts: dict[str, int] = await _count_user_entities(db=db, user_id=user_db.id)
        logger.info(
            f"{username} is already seeded as {user_db.username} with {counts['accounts']} accounts, "
            f"{counts['locations']} locations and {counts['transactions']} transactions"
        )
        answer: str = input(f"Type {RECREATE_ANSWER} to recreate {username}, or another username to seed: ").strip()
        if answer.lower() == RECREATE_ANSWER:
            await _delete_user(db=db, user_id=user_db.id)
            break

        is_username_valid: bool = USERNAME_MIN_LENGTH <= len(answer) <= USERNAME_MAX_LENGTH
        if not is_username_valid:
            logger.info(f"A username has {USERNAME_MIN_LENGTH} to {USERNAME_MAX_LENGTH} characters")
            continue

        username = answer
        user_db = await user_crud.get_user_by_external_id(db=db, external_id=username, provider=ProviderType.TELEGRAM)

    created_user_db: UserModel = await _create_user(db=db, username=username)
    user_id: UUID = created_user_db.id

    accounts: dict[str, UUID] = {}
    for account_db in await account_crud.get_user_accounts(db=db, user_id=user_id):
        accounts[account_db.name] = account_db.id

    for create_data in EXTRA_ACCOUNTS:
        account: Account = await account_service.create_account(db=db, create_data=create_data, user_id=user_id)
        accounts[account.name] = account.id

    locations: dict[str, UUID] = {}
    for name in _location_names():
        location: Location = await location_service.create_location(
            db=db, create_data=LocationCreateRequest(name=name), user_id=user_id
        )
        locations[name] = location.id

    for name, balance, base_currency_amount in OPENING_BALANCES:
        adjustment_data = AdjustmentRequest(
            transaction_date=HISTORY_START,
            new_balance=balance,
            base_currency_amount=base_currency_amount,
            comment="Opening balance",
        )
        await transaction_service.adjust_balance(
            db=db, account_id=accounts[name], adjustment_data=adjustment_data, user_id=user_id
        )

    moves: list[MovementRequest] = _plan_history(
        accounts=accounts, locations=locations, today=date.today(), generator=random.Random(RANDOM_SEED)
    )
    for index, create_data in enumerate(moves):
        await transaction_service.create_transaction(db=db, create_data=create_data, user_id=user_id)
        if index % PROGRESS_STEP == 0:
            logger.info(f"{index}/{len(moves)} transactions")

    logger.info(
        f"{created_user_db.username} now has {len(moves) + len(OPENING_BALANCES)} transactions, "
        f"sign in through mock-oidc as {username}"
    )
    db.expire_all()
    for account_db in await account_crud.get_user_accounts(db=db, user_id=user_id):
        if account_db.currency is not None:
            logger.info(f"{account_db.name}: {account_db.balance} {account_db.currency}")


async def main() -> None:
    async with session_maker() as db:
        async with db.begin():
            await seed(db=db)


if __name__ == "__main__":
    asyncio.run(main())
