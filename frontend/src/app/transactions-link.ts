import type { To } from 'react-router';

import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import type { components } from '@/lib/api-schema';

type Account = components['schemas']['Account'];

export function readTransactionsLink(account: Readonly<Pick<Account, 'id' | 'kind'>>): To {
  const accountIds = [account.id];
  const transactionsLink = {
    pathname: '/transactions',
    search: writeTransactionFilters({
      transaction_types: [],
      account_ids: account.kind === 'EXPENSE' || account.kind === 'INCOME' ? [] : accountIds,
      category_ids: account.kind === 'EXPENSE' ? accountIds : [],
      income_source_ids: account.kind === 'INCOME' ? accountIds : [],
      location_ids: [],
    }).toString(),
  };
  return transactionsLink;
}
