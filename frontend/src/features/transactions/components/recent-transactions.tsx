import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Link } from 'react-router';

import { transactionQueries } from '../api/transaction-queries';
import { useToday } from '../hooks/use-today';
import { NoTransactions } from './no-transactions';
import styles from './recent-transactions.module.css';
import { TransactionDayList } from './transaction-day-list';
import { TransactionSkeletonRows } from './transaction-skeleton-rows';

const RECENT_TRANSACTION_COUNT = 6;

type RecentTransactionsProps = Readonly<{ baseCurrency: string }>;

export function RecentTransactions({ baseCurrency }: RecentTransactionsProps) {
  const today = useToday();
  const { data: transactionPage, isPending } = useQuery(
    transactionQueries.list({
      size: RECENT_TRANSACTION_COUNT,
      date_to: today,
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
      <div className={styles['header']}>
        <h2 id={titleId} className={styles['title']}>
          Recent
        </h2>
        <Link to="/transactions" className={styles['allLink']}>
          All
        </Link>
      </div>
      {transactionPage === undefined ? (
        <TransactionSkeletonRows count={RECENT_TRANSACTION_COUNT} />
      ) : transactionPage.items.length > 0 ? (
        <TransactionDayList transactions={transactionPage.items} baseCurrency={baseCurrency} />
      ) : (
        <NoTransactions />
      )}
    </section>
  );
}
