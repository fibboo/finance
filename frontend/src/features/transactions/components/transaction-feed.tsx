import type { components } from '@/lib/api-schema';

import type { TransactionFeedQuery } from '../hooks/use-transaction-feed';
import { NoTransactions } from './no-transactions';
import styles from './transaction-feed.module.css';
import { TransactionDayList } from './transaction-day-list';
import { TransactionSkeletonRows } from './transaction-skeleton-rows';

type TransactionPage = components['schemas']['Page_Transaction_'];
type Transaction = components['schemas']['Transaction'];

const LOADING_MORE_ROW_COUNT = 2;

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

type TransactionFeedProps = Readonly<{ feed: TransactionFeedQuery; baseCurrency: string }>;

export function TransactionFeed({ feed, baseCurrency }: TransactionFeedProps) {
  const { query, pageSize } = feed;
  const {
    data,
    isPending,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = query;

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
  );
}
