import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useState } from 'react';

import type { components } from '@/lib/api-schema';

import { transactionQueries } from '../api/transaction-queries';
import { usePageSize } from './use-page-size';
import { useToday } from './use-today';

type TransactionPage = components['schemas']['Page_Transaction_'];

export type TransactionFeedQuery = Readonly<{
  query: UseInfiniteQueryResult<InfiniteData<TransactionPage>>;
  pageSize: number;
}>;

export function useTransactionFeed(): TransactionFeedQuery {
  const today = useToday();
  const [dateTo] = useState(today);
  const pageSize = usePageSize();
  const query = useInfiniteQuery({
    ...transactionQueries.feed({ size: pageSize, date_to: dateTo }),
    throwOnError: (_error, failedQuery) => failedQuery.state.data === undefined,
  });
  return { query, pageSize };
}
