---
paths:
  - "backend/app/**"
  - "backend/tests/**"
  - "backend/db_migration/**"
---

# backend

## Primary keys

Every table that owns its `id` generates it in PostgreSQL with `server_default=func.uuidv7(monotonic=True)`. UUIDv7 keys grow with time, so new rows append to the end of the primary-key index instead of landing at random pages. The `monotonic` flag tells SQLAlchemy that the values grow, which lets it insert a batch of rows in one `INSERT … RETURNING` and match the returned keys to the objects (`CRUDBase.create_batch`).

No `id` is a secret. A refresh token (`app/models/user/refresh_token.py`) is a random string the browser keeps in a cookie, and the table stores only its SHA-256 hash, so a UUIDv7 key revealing when a row was created gives nothing away.

## Request transaction

A writing endpoint and every dependency that shares its session take it as `db: DbTransaction` (`app/api/deps.py`), the one declaration of the private `_get_db_transaction` with `scope="function"`. No handler sets the scope itself. A dependency with `yield` in FastAPI's default scope finishes after the response is sent, so the commit would come after the client already saw success: a write that then fails would be reported as done, `/token` would hand out a cookie the database never stored, and the sign-in callback a one-time code whose row is not yet committed. With function scope the transaction commits when the handler returns, before the response goes out, and an exception still passes through the dependency first, so the commit on `RefreshTokenReusedException` keeps working. FastAPI caches a dependency per call and scope, so a session requested with another scope would be a second session in a second transaction; `get_onboarded_user_id` takes `DbTransaction` too and shares the handler's session.

`get_db` gives a plain session for reads and keeps the default scope, since nothing it does has to happen before the response.
