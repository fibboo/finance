import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, type To, useSearchParams } from 'react-router';

import { DetailsColumn } from '@/app/details-column';
import { useBaseCurrency } from '@/app/use-base-currency';
import { useShownAccount } from '@/app/use-shown-account';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import {
  readSelectedTransactionId,
  writeSelectedTransaction,
} from '@/features/transactions/api/selected-transaction';
import type { TransactionFilterQuery } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { readTopTransactionId } from '@/features/transactions/components/feed-transactions';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import { useIsWideDesktop } from '@/hooks/use-is-desktop';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import styles from './catalog-transactions.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type Transaction = components['schemas']['Transaction'];

export const CATALOG_FULL_MENU_MIN_WIDTH = '87rem';

function readIsFilteredTransaction({
  transaction,
  filterQuery,
}: Readonly<{
  transaction: Readonly<Transaction>;
  filterQuery: Readonly<TransactionFilterQuery>;
}>): boolean {
  const accountIds = filterQuery.account_ids ?? [];
  const locationIds = filterQuery.location_ids ?? [];
  const isFilteredTransaction =
    transaction.postings.some((posting) => accountIds.includes(posting.account.id)) ||
    (transaction.location !== null && locationIds.includes(transaction.location.id));
  return isFilteredTransaction;
}

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
  const [searchParams] = useSearchParams();
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const { data: selectedTransaction } = useQuery({
    ...transactionQueries.detail(selectedTransactionId ?? ''),
    enabled: isDetailsShown && selectedTransactionId !== undefined,
  });
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

  if (
    isDetailsShown &&
    selectedTransaction !== undefined &&
    !readIsFilteredTransaction({ transaction: selectedTransaction, filterQuery })
  ) {
    return (
      <Navigate
        to={{
          search: writeSelectedTransaction({ searchParams, transactionId: undefined }).toString(),
        }}
        replace
      />
    );
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
