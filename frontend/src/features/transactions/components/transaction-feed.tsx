import { useInfiniteQuery } from '@tanstack/react-query';

import { transactionQueries } from '../api/transaction-queries';
import { usePageSize } from '../hooks/use-page-size';
import { useToday } from '../hooks/use-today';
import { NoTransactions } from './no-transactions';
import styles from './transaction-feed.module.css';
import { TransactionDayList } from './transaction-day-list';
import { TransactionSkeletonRows } from './transaction-skeleton-rows';

const LOADING_MORE_ROW_COUNT = 2;

function readTransactionCount(total: number): string {
  const transactionCount = `${String(total)} ${total === 1 ? 'transaction' : 'transactions'}`;
  return transactionCount;
}

type TransactionFeedProps = Readonly<{ baseCurrency: string }>;

export function TransactionFeed({ baseCurrency }: TransactionFeedProps) {
  const today = useToday();
  const pageSize = usePageSize();
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery(
    transactionQueries.feed({ size: pageSize, date_to: today }),
  );
  if (!isPending && data === undefined) {
    return null;
  }

  function observeEnd(end: HTMLDivElement | null) {
    if (end === null) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(end);
    return () => {
      observer.disconnect();
    };
  }

  const transactions = data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className={styles['transactionFeed']}>
      <p className={styles['count']}>
        {data === undefined ? ' ' : readTransactionCount(data.pages[0]?.total ?? 0)}
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
            {hasNextPage && <div ref={observeEnd} />}
          </>
        ) : (
          <NoTransactions />
        )}
      </section>
    </div>
  );
}
