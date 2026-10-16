---
paths:
  - "app/**"
  - "tests/**"
  - "db_migration/**"
---

# backend

## Primary keys

Every table that owns its `id` generates it in PostgreSQL with `server_default=func.uuidv7(monotonic=True)`. The transaction subtype tables (`transactions_expense`, `transactions_income`, `transactions_transfer`) generate nothing: their `id` is a foreign key to `transactions.id` and is copied from the base row. UUIDv7 keys grow with time, so new rows append to the end of the primary-key index instead of landing at random pages. The `monotonic` flag tells SQLAlchemy that the values grow, which lets it insert a batch of rows in one `INSERT … RETURNING` and match the returned keys to the objects (`CRUDBase.create_batch`).

`sessions` (`app/models/user/session.py`) is the exception and keeps `gen_random_uuid()`. Its `id` is the `X-Auth-Token` the client sends (`app/api/deps.py`). A UUIDv7 spends 48 of its bits on the creation time and keeps 74 random ones, against 122 in a UUIDv4. So a token would reveal when it was issued and be easier to guess.

## Transaction amounts

Every transaction (`app/models/accounting/transaction.py`) stores the money it moves in five fields:

- `source_amount`: the amount in the withdrawal currency
- `source_currency`: the withdrawal currency
- `destination_amount`: the amount in the receiving currency
- `destination_currency`: the receiving currency
- `base_currency_amount`: the amount in the user's base currency

What source and destination mean depends on the transaction type:

- **Expense**: `source_*` is the amount withdrawn from the account, and `destination_*` is the amount in the seller's or recipient's currency.
- **Income**: `source_*` is the incoming amount in the original currency, and `destination_*` is the amount credited to the receiving account.
- **Transfer**: `source_*` is the withdrawal from one account, and `destination_*` is the deposit to the other account.
