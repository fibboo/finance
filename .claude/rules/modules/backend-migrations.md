---
paths:
  - "backend/db_migration/**"
  - "backend/alembic.ini"
  - "backend/app/models/**"
  - "backend/tests/db_migration/**"
---

# backend: migrations

## Migrations

The application is deployed, and the production database is stamped with the revisions in `db_migration/versions/`. So every schema change adds a new revision on top with `alembic revision --autogenerate`; an existing revision is never edited, deleted or regenerated, since the production database could no longer find it and `alembic upgrade head`, which every deploy runs before the new backend starts, would fail. The previous backend keeps serving on the new schema until the new one replaces it, so a revision that drops or renames a column, or adds a `NOT NULL` column without a default, ships in two deploys: first the code that no longer uses the old shape, then the revision.

The one exception is a revision that never applied in production, because its upgrade failed and rolled back: it is corrected in place, provided the schema it produces stays the same, so the databases that did apply it stay in line.

`transactions` and `postings` have the deferred constraint trigger `transaction_valuation`, so a revision that inserts or updates their rows queues its events until commit, and PostgreSQL refuses to alter a table with pending trigger events, in that revision or in a later one of the same upgrade, which runs in one transaction. Every such revision runs `SET CONSTRAINTS transaction_valuation IMMEDIATE` right after the data change, which fires the events, and `SET CONSTRAINTS transaction_valuation DEFERRED` once it is done, so the revisions after it run as they would alone, as `transaction_entry_order` does. `tests/db_migration/test_migrations.py` applies the head revision to a database with a stored transaction without postings, so it catches a missing statement in a revision that changes rows of `transactions`, not of `postings`.
