import type { TransactionFilters } from '../api/transaction-filters';

export type PendingFilterChange = Readonly<{
  filters: Partial<TransactionFilters>;
  jumpDate?: string | undefined;
}>;

export type PendingFilter = Readonly<{
  readPendingChange: () => PendingFilterChange | undefined;
}>;
