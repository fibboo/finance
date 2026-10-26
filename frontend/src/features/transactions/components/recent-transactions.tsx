import { Link } from 'react-router';

import { useTransactionFeed } from '../hooks/use-transaction-feed';
import styles from './recent-transactions.module.css';
import { TransactionFeed } from './transaction-feed';

type RecentTransactionsProps = Readonly<{ baseCurrency: string }>;

export function RecentTransactions({ baseCurrency }: RecentTransactionsProps) {
  const feed = useTransactionFeed();
  return (
    <div className={styles['recentTransactions']}>
      <TransactionFeed
        feed={feed}
        baseCurrency={baseCurrency}
        label="Recent"
        header={
          <div className={styles['header']}>
            <h2 className={styles['title']}>Recent</h2>
            <Link to="/transactions" className={styles['allLink']}>
              All
            </Link>
          </div>
        }
      />
    </div>
  );
}
