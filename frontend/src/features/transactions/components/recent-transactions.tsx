import { Link } from 'react-router';

import type { components } from '@/lib/api-schema';

import type { TransactionFeedQuery } from '../hooks/use-transaction-feed';
import styles from './recent-transactions.module.css';
import { TransactionFeed } from './transaction-feed';

type DictionaryItem = components['schemas']['DictionaryItem'];

type RecentTransactionsProps = Readonly<{
  feed: TransactionFeedQuery;
  topTransactionId: string | undefined;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[] | undefined;
}>;

export function RecentTransactions({
  feed,
  topTransactionId,
  baseCurrency,
  transactionTypes,
}: RecentTransactionsProps) {
  return (
    <div className={styles['recentTransactions']}>
      <TransactionFeed
        feed={feed}
        baseCurrency={baseCurrency}
        transactionTypes={transactionTypes}
        topTransactionId={topTransactionId}
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
