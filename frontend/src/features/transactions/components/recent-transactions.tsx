import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { components } from '@/lib/api-schema';

import { useTransactionFeed } from '../hooks/use-transaction-feed';
import { readTopTransactionId } from './feed-transactions';
import styles from './recent-transactions.module.css';
import { TransactionFeed } from './transaction-feed';

type DictionaryItem = components['schemas']['DictionaryItem'];

type RecentTransactionsProps = Readonly<{
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[] | undefined;
  renderDetails: (topTransactionId: string | undefined) => ReactNode;
}>;

export function RecentTransactions({
  baseCurrency,
  transactionTypes,
  renderDetails,
}: RecentTransactionsProps) {
  const feed = useTransactionFeed({
    isOpeningDayKept: false,
    isFirstPageErrorThrown: false,
    filterQuery: {},
  });
  const topTransactionId = readTopTransactionId(feed);
  if (feed.query.isError && feed.query.data === undefined) {
    return renderDetails(undefined);
  }

  return (
    <>
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
      {renderDetails(topTransactionId)}
    </>
  );
}
