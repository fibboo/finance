import { Link } from 'react-router';

import type { components } from '@/lib/api-schema';

import { useTransactionFeed } from '../hooks/use-transaction-feed';
import styles from './recent-transactions.module.css';
import { TransactionFeed } from './transaction-feed';

type DictionaryItem = components['schemas']['DictionaryItem'];

type RecentTransactionsProps = Readonly<{
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[] | undefined;
}>;

export function RecentTransactions({ baseCurrency, transactionTypes }: RecentTransactionsProps) {
  const feed = useTransactionFeed({
    isOpeningDayKept: false,
    isFirstPageErrorThrown: false,
    filterQuery: {},
  });
  if (feed.query.isError && feed.query.data === undefined) {
    return null;
  }

  return (
    <div className={styles['recentTransactions']}>
      <TransactionFeed
        feed={feed}
        baseCurrency={baseCurrency}
        transactionTypes={transactionTypes}
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
