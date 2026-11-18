import { hashKey, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, Navigate, type To, useSearchParams } from 'react-router';

import { DetailsColumn } from '@/app/details-column';
import { useBaseCurrency } from '@/app/use-base-currency';
import { SkeletonLine } from '@/components/skeleton/skeleton-line';
import {
  readSelectedTransactionId,
  writeSelectedTransaction,
} from '@/features/transactions/api/selected-transaction';
import type { TransactionFilterQuery } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { TRANSACTION_ARROW_KEY_LIST } from '@/features/transactions/components/transaction-arrow-keys';
import { readTopTransactionId } from '@/features/transactions/components/feed-transactions';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import { useListFocusKeys } from '@/hooks/use-arrow-key-selection';
import { useIsWideDesktop } from '@/hooks/use-is-desktop';
import type { components } from '@/lib/api-schema';

import styles from './catalog-transactions.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type Transaction = components['schemas']['Transaction'];
export const CATALOG_FULL_MENU_MIN_WIDTH = '87rem';

export const CATALOG_DESCRIPTION_SEPARATOR = ' · ';

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

export type CatalogEntryFeed = Readonly<{
  name: string;
  description: string;
  filterQuery: Readonly<TransactionFilterQuery>;
  transactionsLink: To;
}>;

type CatalogTransactionsProps = Readonly<{
  entryFeed: CatalogEntryFeed | undefined;
  emptyText: string;
  transactionTypes: readonly DictionaryItem[] | undefined;
  summary?: ReactNode;
}>;

export function CatalogTransactions({
  entryFeed,
  emptyText,
  transactionTypes,
  summary,
}: CatalogTransactionsProps) {
  const filterQuery = entryFeed?.filterQuery;
  const baseCurrency = useBaseCurrency();
  const isDetailsShown = useIsWideDesktop();
  useListFocusKeys({
    rightList: TRANSACTION_ARROW_KEY_LIST['data-arrow-key-list'],
    isEnabled: isDetailsShown,
  });
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
  const entryAccountIds = filterQuery?.account_ids ?? [];
  const entryLocationIds = filterQuery?.location_ids ?? [];
  const isFailed = feed.query.isError && feed.query.data === undefined;
  if (baseCurrency === undefined || isFailed) {
    return null;
  }

  const isSelectedTransactionOfOtherEntry =
    isDetailsShown &&
    selectedTransaction !== undefined &&
    filterQuery !== undefined &&
    !readIsFilteredTransaction({ transaction: selectedTransaction, filterQuery });
  return (
    <>
      {isSelectedTransactionOfOtherEntry && (
        <Navigate
          to={{
            search: writeSelectedTransaction({ searchParams, transactionId: undefined }).toString(),
          }}
          replace
        />
      )}
      <aside className={styles['catalogTransactions']}>
        <TransactionFeed
          key={filterQuery === undefined ? undefined : hashKey([filterQuery])}
          feed={feed}
          baseCurrency={baseCurrency}
          transactionTypes={transactionTypes}
          topTransactionId={topTransactionId}
          label={entryFeed === undefined ? 'Transactions' : `Transactions of ${entryFeed.name}`}
          selection={isDetailsShown ? 'keysInList' : 'none'}
          omittedAccountIds={entryAccountIds}
          emptyState={<p className={styles['empty']}>{emptyText}</p>}
          header={
            <div className={styles['header']}>
              {entryFeed === undefined ? (
                <div className={styles['heading']} aria-hidden="true">
                  <SkeletonLine
                    textClassName={styles['description']}
                    className={styles['descriptionSkeleton']}
                  />
                  <SkeletonLine textClassName={styles['name']} className={styles['nameSkeleton']} />
                </div>
              ) : (
                <>
                  <div className={styles['heading']}>
                    <p className={styles['description']}>{entryFeed.description}</p>
                    <h2 className={styles['name']}>{entryFeed.name}</h2>
                  </div>
                  <Link to={entryFeed.transactionsLink} className={styles['allLink']}>
                    All
                  </Link>
                </>
              )}
              {summary !== undefined && <div className={styles['summary']}>{summary}</div>}
            </div>
          }
        />
      </aside>
      {isDetailsShown && (
        <div className={styles['details']}>
          <DetailsColumn
            baseCurrency={baseCurrency}
            defaultTransactionId={topTransactionId}
            isDefaultTransactionPending={feed.query.isPending}
            omittedAccountIds={entryAccountIds}
            omittedLocationIds={entryLocationIds}
            shownAccount={undefined}
          />
        </div>
      )}
    </>
  );
}
