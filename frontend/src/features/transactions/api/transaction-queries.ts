import { infiniteQueryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type TransactionPage = components['schemas']['Page_Transaction_'];
export type TransactionListQuery = NonNullable<
  operations['get_transactions_accounting_transactions_get']['parameters']['query']
>;

async function fetchTransactions(query: Readonly<TransactionListQuery>): Promise<TransactionPage> {
  const transactions = readData(
    await apiClient.GET('/accounting/transactions', { params: { query } }),
  );
  return transactions;
}

export const transactionQueries = {
  feed(query: Readonly<Omit<TransactionListQuery, 'page'>>) {
    return infiniteQueryOptions({
      queryKey: ['transactions', 'feed', query],
      queryFn: ({ pageParam }) => fetchTransactions({ ...query, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    });
  },
};
