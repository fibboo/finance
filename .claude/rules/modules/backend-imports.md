---
paths:
  - "backend/**/transaction_import*.py"
  - "backend/**/accounting/test_transaction_import*.py"
---

# backend: transaction imports

Reviewed rows are stored separately from the ledger so an upload survives a reload without affecting balances. The file hash identifies repeated uploads while preserving the original row numbers and entered names for later matching.

Upload serializes replacement on the user row, including the first upload when there is no import row to lock. The partial unique index enforces one open import per user. Upload and discard both lock the import being changed so that a concurrent discard cannot cancel a replacement.
