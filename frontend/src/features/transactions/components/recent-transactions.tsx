import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';

import { transactionQueries } from '../api/transaction-queries';
import styles from './recent-transactions.module.css';
import { TransactionDayList } from './transaction-day-list';

const RECENT_TRANSACTION_COUNT = 6;

function readLocalToday(): string {
  const today = new Date();
  const localToday = [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return localToday;
}

type RecentTransactionsProps = Readonly<{ baseCurrency: string }>;

export function RecentTransactions({ baseCurrency }: RecentTransactionsProps) {
  const { data: transactionPage, isPending } = useQuery(
    transactionQueries.list({
      size: RECENT_TRANSACTION_COUNT,
      date_to: readLocalToday(),
    }),
  );
  const titleId = useId();
  if (!isPending && transactionPage === undefined) {
    return null;
  }

  return (
    <section
      className={styles['recentTransactions']}
      aria-labelledby={titleId}
      aria-busy={isPending}
    >
      <h2 id={titleId} className={styles['title']}>
        Recent
      </h2>
      {transactionPage === undefined ? (
        <ul className={styles['transactions']}>
          {listSkeletonKeys(RECENT_TRANSACTION_COUNT).map((key) => (
            <li key={key} className={styles['skeletonRow']}>
              <Skeleton className={styles['dotSkeleton']} />
              <Skeleton className={styles['titleSkeleton']} />
              <Skeleton className={styles['accountsSkeleton']} />
              <Skeleton className={styles['amountSkeleton']} />
            </li>
          ))}
        </ul>
      ) : transactionPage.items.length > 0 ? (
        <TransactionDayList transactions={transactionPage.items} baseCurrency={baseCurrency} />
      ) : (
        <p className={styles['empty']}>
          <span className={styles['emptyTitle']}>Nothing here yet</span>
          <span className={styles['emptyText']}>Your income and expenses will show up here.</span>
        </p>
      )}
    </section>
  );
}
