import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { components } from '@/lib/api-schema';

import { transactionQueries } from '../api/transaction-queries';
import { usePageSize } from '../hooks/use-page-size';
import { useToday } from '../hooks/use-today';
import { NoTransactions } from './no-transactions';
import styles from './transaction-feed.module.css';
import { TransactionDayList } from './transaction-day-list';
import { TransactionSkeletonRows } from './transaction-skeleton-rows';

type TransactionPage = components['schemas']['Page_Transaction_'];
type Transaction = components['schemas']['Transaction'];

const LOADING_MORE_ROW_COUNT = 2;

function readTransactionCount(total: number): string {
  const transactionCount = `${String(total)} ${total === 1 ? 'transaction' : 'transactions'}`;
  return transactionCount;
}

function mergePages(pages: readonly TransactionPage[]): readonly Transaction[] {
  const seenIds = new Set<string>();
  const transactions: Transaction[] = [];
  for (const transaction of pages.flatMap((page) => page.items)) {
    if (!seenIds.has(transaction.id)) {
      seenIds.add(transaction.id);
      transactions.push(transaction);
    }
  }

  return transactions;
}

type TransactionFeedProps = Readonly<{ baseCurrency: string }>;

export function TransactionFeed({ baseCurrency }: TransactionFeedProps) {
  const today = useToday();
  const [dateTo] = useState(today);
  const pageSize = usePageSize();
  const {
    data,
    isPending,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteQuery({
    ...transactionQueries.feed({ size: pageSize, date_to: dateTo }),
    throwOnError: (_error, query) => query.state.data === undefined,
  });

  function observeEnd(end: HTMLDivElement | null) {
    if (end === null) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetching) {
        void fetchNextPage();
      }
    });
    observer.observe(end);
    return () => {
      observer.disconnect();
    };
  }

  const transactions = data === undefined ? [] : mergePages(data.pages);
  return (
    <div className={styles['transactionFeed']}>
      <p className={styles['count']}>
        {data === undefined ? ' ' : readTransactionCount(data.pages.at(-1)?.total ?? 0)}
      </p>
      <section
        aria-label="Transactions"
        aria-busy={isPending || isFetchingNextPage}
        className={styles['transactions']}
      >
        {data === undefined ? (
          <TransactionSkeletonRows count={pageSize} />
        ) : transactions.length > 0 ? (
          <>
            <TransactionDayList transactions={transactions} baseCurrency={baseCurrency} />
            {isFetchingNextPage && <TransactionSkeletonRows count={LOADING_MORE_ROW_COUNT} />}
            {hasNextPage && !isFetchingNextPage && isFetchNextPageError && (
              <p className={styles['loadMoreError']}>
                Couldn&apos;t load more
                <button
                  type="button"
                  className={styles['retry']}
                  onClick={() => {
                    void fetchNextPage();
                  }}
                >
                  Try again
                </button>
              </p>
            )}
            {hasNextPage && !isFetchNextPageError && <div ref={observeEnd} />}
          </>
        ) : (
          <NoTransactions />
        )}
      </section>
    </div>
  );
}
