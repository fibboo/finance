import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useState } from 'react';

import type { components } from '@/lib/api-schema';

import { transactionQueries } from '../api/transaction-queries';
import { usePageSize } from './use-page-size';
import { useToday } from '@/hooks/use-today';

type TransactionPage = components['schemas']['Page_Transaction_'];

export type TransactionFeedQuery = Readonly<{
  query: UseInfiniteQueryResult<InfiniteData<TransactionPage>>;
  pageSize: number;
}>;

type TransactionFeedOptions = Readonly<{
  isOpeningDayKept: boolean;
  isFirstPageErrorThrown: boolean;
}>;

export function useTransactionFeed({
  isOpeningDayKept,
  isFirstPageErrorThrown,
}: TransactionFeedOptions): TransactionFeedQuery {
  const today = useToday();
  const [openingDay] = useState(today);
  const pageSize = usePageSize();
  const query = useInfiniteQuery({
    ...transactionQueries.feed({ size: pageSize, date_to: isOpeningDayKept ? openingDay : today }),
    throwOnError: (_error, failedQuery) =>
      isFirstPageErrorThrown && failedQuery.state.data === undefined,
  });
  return { query, pageSize };
}
