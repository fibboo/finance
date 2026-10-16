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

## Sign-in

The backend is the OpenID Connect client towards the providers and the authorization server towards our own clients (`app/services/user/auth/auth_service.py`). A client opens `GET /user/auth/authorize/{provider}` with its `redirect_uri`, its own `state` and a PKCE S256 `code_challenge`. The `redirect_uri` must be in `allowed_redirect_uris`, since the one-time code is sent there. An `authorization_requests` row keeps our own `state`, `nonce` and provider PKCE verifier next to what the client sent, and the client is redirected to the provider.

The provider returns to `GET /user/auth/callback/{provider}`. The code is exchanged and the ID token is checked against the provider's JWKS, `iss`, `aud`, `exp` and `nonce` (`oidc_provider.py`). The user is found by provider and `sub`, or created, and the row gets the hash of a one-time code that lives one minute. An unknown, expired or already completed `state` answers 401, because there is no trusted client to redirect to. A provider error, a failed code exchange or a rejected ID token redirects to the client with `error` and writes nothing. `POST /user/auth/token` with `grant_type=authorization_code` accepts the code once, for the same `redirect_uri`, with the verifier matching the stored challenge.

Each call builds a fresh Authlib client, so the discovery document and the JWKS are fetched per request instead of cached in the process. A provider is one entry in `providers.py`; its claims are read by their standard OIDC names. Users are matched by provider and `sub`; Telegram's `sub` is not the Telegram user id, which is the separate `id` claim.

## Base currency

A user is created without a base currency (`users.base_currency` is nullable), so that signing in needs nothing but the provider's answer. The client chooses it once afterwards with `PUT /user/me/base_currency` (`user_service.set_base_currency`), which also creates the standard accounts in that currency. It cannot be changed: a second call with another currency answers 409 `BASE_CURRENCY_ALREADY_SET`, because every stored `base_currency_amount` is in that currency. The update only matches a row whose currency is still null, so two concurrent calls cannot both create the standard accounts. A repeated call with the stored currency returns the user unchanged, so a client can retry it safely. Until it is set, `user_service.get_user_base_currency` answers 409 `BASE_CURRENCY_NOT_SET`, which tells the client to show onboarding. Reads keep working, but creating an account, category, location, income source or transaction is refused with that 409: the create endpoints take the user id from `get_onboarded_user_id` (`app/api/deps.py`), which asks `get_user_base_currency` first. So a user has no accounts until the base currency is set, and the standard accounts it creates can neither collide with an existing account name nor exceed `max_accounts_per_user`.

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
