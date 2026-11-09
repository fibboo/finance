import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useState } from 'react';

import type { components } from '@/lib/api-schema';

import { OLDEST_FIRST_ORDER, type TransactionFilterQuery } from '../api/transaction-filters';
import { transactionQueries } from '../api/transaction-queries';
import { usePageSize } from './use-page-size';
import { useToday } from '@/hooks/use-today';
import { isThrownWithoutData } from '@/lib/query-meta';

type TransactionPage = components['schemas']['Page_Transaction_'];
type TransactionPagesQuery = UseInfiniteQueryResult<InfiniteData<TransactionPage>>;

export type TransactionFeedQuery = Readonly<{
  query: TransactionPagesQuery;
  newerQuery: TransactionPagesQuery | undefined;
  anchorDate: string | undefined;
  total: number | undefined;
  pageSize: number;
}>;

type TransactionFeedOptions = Readonly<{
  isOpeningDayKept: boolean;
  isFirstPageErrorThrown: boolean;
  filterQuery: Readonly<TransactionFilterQuery> | undefined;
  anchorDate?: string | undefined;
}>;

function readNextDay(date: string): string {
  const nextDay = new Date(`${date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const isoDate = nextDay.toISOString().slice(0, 10);
  return isoDate;
}

export function useTransactionFeed({
  isOpeningDayKept,
  isFirstPageErrorThrown,
  filterQuery,
  anchorDate,
}: TransactionFeedOptions): TransactionFeedQuery {
  const today = useToday();
  const [openingDay] = useState(today);
  const pageSize = usePageSize();
  const hasStartDate = (filterQuery?.date_from ?? null) !== null;
  const lastDay = isOpeningDayKept && !hasStartDate ? openingDay : today;
  const firstNewerDay = anchorDate === undefined ? undefined : readNextDay(anchorDate);
  const hasNewerDays = firstNewerDay !== undefined && firstNewerDay <= lastDay;
  const query = useInfiniteQuery({
    ...transactionQueries.feed({
      ...filterQuery,
      size: pageSize,
      date_to: anchorDate ?? lastDay,
    }),
    enabled: filterQuery !== undefined,
    placeholderData: keepPreviousData,
    throwOnError: (error, failedQuery) =>
      isFirstPageErrorThrown && isThrownWithoutData(error, failedQuery),
  });
  const newerQuery = useInfiniteQuery({
    ...transactionQueries.feed({
      ...filterQuery,
      size: pageSize,
      date_from: firstNewerDay ?? null,
      date_to: lastDay,
      orders: [OLDEST_FIRST_ORDER],
    }),
    enabled: filterQuery !== undefined && hasNewerDays,
  });
  const olderTotal = query.isPlaceholderData ? undefined : query.data?.pages.at(-1)?.total;
  const newerTotal = hasNewerDays ? newerQuery.data?.pages.at(-1)?.total : 0;
  const total =
    olderTotal === undefined || newerTotal === undefined ? undefined : olderTotal + newerTotal;
  return {
    query,
    newerQuery: hasNewerDays ? newerQuery : undefined,
    anchorDate: hasNewerDays ? anchorDate : undefined,
    total,
    pageSize,
  };
}
