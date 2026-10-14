---
paths:
  - "app/**"
  - "tests/**"
  - "db_migration/**"
---

# backend

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
