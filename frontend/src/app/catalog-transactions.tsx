import { useQuery } from '@tanstack/react-query';
import { Link, type To } from 'react-router';

import { DetailsColumn } from '@/app/details-column';
import { useBaseCurrency } from '@/app/use-base-currency';
import { useShownAccount } from '@/app/use-shown-account';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import type { TransactionFilterQuery } from '@/features/transactions/api/transaction-filters';
import { readTopTransactionId } from '@/features/transactions/components/feed-transactions';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import { useIsWideDesktop } from '@/hooks/use-is-desktop';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import styles from './catalog-transactions.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];

export const CATALOG_FULL_MENU_MIN_WIDTH = '87rem';

type CatalogTransactionsProps = Readonly<{
  name: string;
  description: string;
  emptyText: string;
  filterQuery: Readonly<TransactionFilterQuery>;
  transactionsLink: To;
  transactionTypes: readonly DictionaryItem[] | undefined;
}>;

export function CatalogTransactions({
  name,
  description,
  emptyText,
  filterQuery,
  transactionsLink,
  transactionTypes,
}: CatalogTransactionsProps) {
  const baseCurrency = useBaseCurrency();
  const isDetailsShown = useIsWideDesktop();
  const feed = useTransactionFeed({
    isOpeningDayKept: false,
    isFirstPageErrorThrown: false,
    filterQuery,
  });
  const topTransactionId = isDetailsShown ? readTopTransactionId(feed) : undefined;
  const shownAccount = useShownAccount({
    defaultTransactionId: topTransactionId,
    firstAccountId: undefined,
  });
  const { data: moneyAccountPage } = useQuery({
    ...accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: [...MONEY_ACCOUNT_KINDS],
      order: 'recent_use',
    }),
    enabled: isDetailsShown,
  });
  const isFailed = feed.query.isError && feed.query.data === undefined;
  if (baseCurrency === undefined || isFailed) {
    return null;
  }

  return (
    <>
      <aside className={styles['catalogTransactions']}>
        <TransactionFeed
          feed={feed}
          baseCurrency={baseCurrency}
          transactionTypes={transactionTypes}
          topTransactionId={topTransactionId}
          label={`Transactions of ${name}`}
          selection={isDetailsShown ? 'keysInList' : 'none'}
          emptyState={<p className={styles['empty']}>{emptyText}</p>}
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
      {isDetailsShown && (
        <DetailsColumn
          baseCurrency={baseCurrency}
          defaultTransactionId={topTransactionId}
          shownAccount={shownAccount}
          accountCount={moneyAccountPage?.total}
          isAccountFirst={false}
          isEntryParamOwnedByPage
        />
      )}
    </>
  );
}
