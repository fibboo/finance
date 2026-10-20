import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

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
  const { data: transactionPage } = useQuery(
    transactionQueries.list({
      size: RECENT_TRANSACTION_COUNT,
      date_from: EARLIEST_TRANSACTION_DATE,
      date_to: readLocalToday(),
    }),
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
