import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import {
  hasNarrowingFilters,
  isSortedByDate,
  readTransactionFilterQuery,
  readTransactionFilters,
  type TransactionFilters,
  writeTransactionFilters,
} from '@/features/transactions/api/transaction-filters';
import { FilterChips } from '@/features/transactions/components/filter-chips';
import { NoMatchingTransactions } from '@/features/transactions/components/no-matching-transactions';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useDateJump } from '@/features/transactions/hooks/use-date-jump';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import { useToday } from '@/hooks/use-today';

function readTransactionCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const transactionCount =
    total === undefined
      ? undefined
      : { value: total, label: total === 1 ? 'transaction' : 'transactions' };
  return transactionCount;
}

function readJumpDate({
  date,
  filters,
}: Readonly<{ date: string; filters: TransactionFilters }>): string {
  const jumpDate =
    filters.date_from !== undefined && date < filters.date_from ? filters.date_from : date;
  return jumpDate;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const today = useToday();
  const [searchParams, setSearchParams] = useSearchParams();
  const listKey = searchParams.toString();
  const { anchorDate, jumpToDate, clearJump } = useDateJump(listKey);
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const filters =
    dictionaries === undefined
      ? undefined
      : readTransactionFilters({ searchParams, orders: dictionaries.transaction_orders, today });
  const feed = useTransactionFeed({
    isOpeningDayKept: true,
    isFirstPageErrorThrown: true,
    filterQuery: filters === undefined ? undefined : readTransactionFilterQuery(filters),
    anchorDate,
  });
  return (
    <Page title="Transactions" count={readTransactionCount(feed.total)}>
      {baseCurrency !== undefined && dictionaries !== undefined && filters !== undefined && (
        <FilterChips
          filters={filters}
          today={today}
          anchorDate={anchorDate}
          baseCurrency={baseCurrency}
          transactionTypes={dictionaries.transaction_types}
          transactionOrders={dictionaries.transaction_orders}
          onApply={(change, jumpDate) => {
            const nextFilters = { ...filters, ...change };
            const nextSearchParams = writeTransactionFilters(nextFilters);
            setSearchParams(nextSearchParams);
            if (jumpDate === undefined) {
              clearJump();
            } else {
              jumpToDate({
                date: readJumpDate({ date: jumpDate, filters: nextFilters }),
                listKey: nextSearchParams.toString(),
              });
            }
          }}
          onJump={(monthEnd) => {
            jumpToDate({ date: readJumpDate({ date: monthEnd, filters }), listKey });
          }}
        />
      )}
      {baseCurrency !== undefined && (
        <TransactionFeed
          key={`${listKey}#${feed.anchorDate ?? ''}`}
          feed={feed}
          baseCurrency={baseCurrency}
          label="Transactions"
          isGroupedByDay={filters === undefined || isSortedByDate(filters)}
          onReturnToToday={clearJump}
          {...(filters !== undefined &&
            hasNarrowingFilters(filters) && {
              emptyState: (
                <NoMatchingTransactions
                  onReset={() => {
                    clearJump();
                    setSearchParams({});
                  }}
                />
              ),
            })}
        />
      )}
    </Page>
  );
}
