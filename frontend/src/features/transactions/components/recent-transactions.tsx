import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';

import { transactionQueries } from '../api/transaction-queries';
import styles from './recent-transactions.module.css';
import { TransactionRow } from './transaction-row';

const RECENT_TRANSACTION_COUNT = 6;
const EARLIEST_TRANSACTION_DATE = '0001-01-01';

function readLocalToday(): string {
  const today = new Date();
  const localToday = [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return localToday;
}

export function RecentTransactions() {
  const { data: transactionPage, isPending } = useQuery(
    transactionQueries.list({
      size: RECENT_TRANSACTION_COUNT,
      date_from: EARLIEST_TRANSACTION_DATE,
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
              <Skeleton className={styles['dateSkeleton']} />
              <Skeleton className={styles['amountSkeleton']} />
            </li>
          ))}
        </ul>
      ) : transactionPage.items.length > 0 ? (
        <ul className={styles['transactions']}>
          {transactionPage.items.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      ) : (
        <p className={styles['empty']}>
          <span className={styles['emptyTitle']}>Nothing here yet</span>
          <span className={styles['emptyText']}>Your income and expenses will show up here.</span>
        </p>
      )}
    </section>
  );
}
