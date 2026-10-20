import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type TransactionPage = components['schemas']['Page_Transaction_'];
type TransactionListQuery = NonNullable<
  operations['get_transactions_accounting_transactions_get']['parameters']['query']
>;

async function fetchTransactions(query: Readonly<TransactionListQuery>): Promise<TransactionPage> {
  const transactions = readData(
    await apiClient.GET('/accounting/transactions', { params: { query } }),
  );
  return transactions;
}

export const transactionQueries = {
  list(query: Readonly<TransactionListQuery>) {
    return queryOptions({
      queryKey: ['transactions', 'list', query],
      queryFn: () => fetchTransactions(query),
    });
  },
};
