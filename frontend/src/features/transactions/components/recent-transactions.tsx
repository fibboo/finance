import { Link } from 'react-router';

import { useTransactionFeed } from '../hooks/use-transaction-feed';
import styles from './recent-transactions.module.css';
import { TransactionFeed } from './transaction-feed';

type RecentTransactionsProps = Readonly<{ baseCurrency: string }>;

export function RecentTransactions({ baseCurrency }: RecentTransactionsProps) {
  const feed = useTransactionFeed({ isOpeningDayKept: false, isFirstPageErrorThrown: false });
  if (feed.query.isError && feed.query.data === undefined) {
    return null;
  }

  return (
    <div className={styles['recentTransactions']}>
      <TransactionFeed
        feed={feed}
        baseCurrency={baseCurrency}
        label="Recent transactions"
        header={
          <div className={styles['header']}>
            <h2 className={styles['title']}>Recent transactions</h2>
            <Link to="/transactions" className={styles['allLink']}>
              All
            </Link>
          </div>
        }
      />
    </div>
  );
}
