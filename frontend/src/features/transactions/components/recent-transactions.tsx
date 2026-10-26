import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Link } from 'react-router';

import { transactionQueries } from '../api/transaction-queries';
import { useFittingRowCount } from '../hooks/use-fitting-row-count';
import { usePageSize } from '../hooks/use-page-size';
import { useToday } from '../hooks/use-today';
import { NoTransactions } from './no-transactions';
import styles from './recent-transactions.module.css';
import { TransactionDayList } from './transaction-day-list';
import { TransactionSkeletonRows } from './transaction-skeleton-rows';

type RecentTransactionsProps = Readonly<{ baseCurrency: string }>;

export function RecentTransactions({ baseCurrency }: RecentTransactionsProps) {
  const today = useToday();
  const pageSize = usePageSize();
  const { ref: fitRows, count: fittingRowCount } = useFittingRowCount();
  const { data: transactionPage, isPending } = useQuery(
    transactionQueries.list({
      size: pageSize,
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
        <div className={styles['rows']}>
          <TransactionSkeletonRows count={pageSize} />
        </div>
      ) : transactionPage.items.length > 0 ? (
        <div ref={fitRows} className={styles['rows']}>
          <TransactionDayList
            transactions={transactionPage.items}
            baseCurrency={baseCurrency}
            visibleCount={fittingRowCount}
          />
        </div>
      ) : (
        <NoTransactions />
      )}
    </section>
  );
}
