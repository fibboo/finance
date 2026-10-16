---
paths:
  - "app/**"
  - "tests/**"
  - "db_migration/**"
---

# backend

## Primary keys

Every table that owns its `id` generates it in PostgreSQL with `server_default=func.uuidv7(monotonic=True)`. The transaction subtype tables (`transactions_expense`, `transactions_income`, `transactions_transfer`) generate nothing: their `id` is a foreign key to `transactions.id` and is copied from the base row. UUIDv7 keys grow with time, so new rows append to the end of the primary-key index instead of landing at random pages. The `monotonic` flag tells SQLAlchemy that the values grow, which lets it insert a batch of rows in one `INSERT … RETURNING` and match the returned keys to the objects (`CRUDBase.create_batch`).

No `id` is a secret. A refresh token (`app/models/user/refresh_token.py`) is a random string the client keeps, and the table stores only its SHA-256 hash, so a UUIDv7 key revealing when a row was created gives nothing away.

## Tokens

The API authenticates by a short-lived HS256 JWT access token (`app/services/user/token_service.py`). `get_user_id` (`app/api/deps.py`) checks its signature and expiry and returns its `sub` without reading the database, so an access token stays valid until it expires even after its refresh token is revoked.

Refresh tokens rotate: each use revokes the presented token and issues a new one in the same family. Presenting a token that is already revoked means it was copied, so the whole family is revoked (reuse detection). That revocation must outlive the 401 it answers with, while `get_db_transaction` rolls a request back on any exception. So `get_db_transaction` commits before re-raising `RefreshTokenReusedException`, and only that one.

## Base currency

A user is created without a base currency (`users.base_currency` is nullable), so that signing in needs nothing but the provider's answer. The client chooses it once afterwards with `PUT /user/me/base_currency` (`user_service.set_base_currency`), which also creates the standard accounts in that currency. It cannot be changed: a second call answers 409 `BASE_CURRENCY_ALREADY_SET`, because every stored `base_currency_amount` is in that currency. The update only matches a row whose currency is still null, so two concurrent calls cannot both create the standard accounts. Until it is set, `user_service.get_user_base_currency` answers 409 `BASE_CURRENCY_NOT_SET`, which tells the client to show onboarding.

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
