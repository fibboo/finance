import { Link, type To } from 'react-router';

import { useBaseCurrency } from '@/app/use-base-currency';
import type { TransactionFilterQuery } from '@/features/transactions/api/transaction-filters';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import type { components } from '@/lib/api-schema';

import styles from './catalog-transactions.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];

type CatalogTransactionsProps = Readonly<{
  name: string;
  description: string;
  filterQuery: Readonly<TransactionFilterQuery>;
  transactionsLink: To;
  transactionTypes: readonly DictionaryItem[] | undefined;
}>;

export function CatalogTransactions({
  name,
  description,
  filterQuery,
  transactionsLink,
  transactionTypes,
}: CatalogTransactionsProps) {
  const baseCurrency = useBaseCurrency();
  const feed = useTransactionFeed({
    isOpeningDayKept: false,
    isFirstPageErrorThrown: false,
    filterQuery,
  });
  const isFailed = feed.query.isError && feed.query.data === undefined;
  if (baseCurrency === undefined || isFailed) {
    return null;
  }

  return (
    <aside className={styles['catalogTransactions']}>
      <TransactionFeed
        feed={feed}
        baseCurrency={baseCurrency}
        transactionTypes={transactionTypes}
        topTransactionId={undefined}
        label={`Transactions of ${name}`}
        isSelectable={false}
        header={
          <div className={styles['header']}>
            <div className={styles['heading']}>
              <p className={styles['description']}>{description}</p>
              <h2 className={styles['name']}>{name}</h2>
            </div>
            <Link to={transactionsLink} className={styles['allLink']}>
              All
            </Link>
          </div>
        }
      />
    </aside>
  );
}
