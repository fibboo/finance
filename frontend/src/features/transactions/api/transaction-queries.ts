import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type Transaction = components['schemas']['Transaction'];
type TransactionPage = components['schemas']['Page_Transaction_'];
export type TransactionListQuery = NonNullable<
  operations['get_transactions_accounting_transactions_get']['parameters']['query']
>;

const FEED_KEY = ['transactions', 'feed'] as const;

async function fetchTransactions(query: Readonly<TransactionListQuery>): Promise<TransactionPage> {
  const transactions = readData(
    await apiClient.GET('/accounting/transactions', { params: { query } }),
  );
  return transactions;
}

async function fetchTransaction(transactionId: string): Promise<Transaction> {
  const transaction = readData(
    await apiClient.GET('/accounting/transactions/{transaction_id}', {
      params: { path: { transaction_id: transactionId } },
    }),
  );
  return transaction;
}

export const transactionQueries = {
  feeds() {
    return { queryKey: FEED_KEY };
  },
  feed(query: Readonly<Omit<TransactionListQuery, 'page'>>) {
    return infiniteQueryOptions({
      queryKey: [...FEED_KEY, query],
      queryFn: ({ pageParam }) => fetchTransactions({ ...query, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    });
  },
  detail(transactionId: string) {
    return queryOptions({
      queryKey: ['transactions', 'detail', transactionId],
      queryFn: () => fetchTransaction(transactionId),
    });
  },
};
