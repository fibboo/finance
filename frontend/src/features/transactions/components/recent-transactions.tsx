import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { transactionQueries } from '../api/transaction-queries';
import styles from './recent-transactions.module.css';
import { TransactionRow } from './transaction-row';

const RECENT_TRANSACTION_COUNT = 6;

export function RecentTransactions() {
  const { data: transactionPage } = useQuery(
    transactionQueries.list({ size: RECENT_TRANSACTION_COUNT }),
  );
  const titleId = useId();
  if (transactionPage === undefined) {
    return null;
  }

  return (
    <section className={styles['recentTransactions']} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles['title']}>
        Recent
      </h2>
      {transactionPage.items.length > 0 ? (
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
