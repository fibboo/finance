import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, type To, useSearchParams } from 'react-router';

import { SelectedTransactionDetails } from '@/app/selected-transaction-details';
import { useBaseCurrency } from '@/app/use-base-currency';
import { writeDeletedShown } from '@/components/catalog-list/deleted-filter';
import { writeSelectedAccount } from '@/features/accounts/api/selected-account';
import {
  readLocationLinkId,
  writeSelectedLocation,
} from '@/features/locations/api/selected-location';
import {
  readSelectedTransactionId,
  writeSelectedTransaction,
} from '@/features/transactions/api/selected-transaction';
import type { TransactionFilterQuery } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { readTopTransactionId } from '@/features/transactions/components/feed-transactions';
import type { LocationLink } from '@/features/transactions/components/transaction-overview';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import { useIsWideDesktop } from '@/hooks/use-is-desktop';
import type { components } from '@/lib/api-schema';

import styles from './catalog-transactions.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];

const ACCOUNT_SECTION_PATHNAMES = {
  ASSET: '/accounts',
  LIABILITY: '/accounts',
  EXPENSE: '/categories',
  INCOME: '/income-sources',
  EQUITY: '/accounts',
} as const satisfies Readonly<Record<Account['kind'], string>>;

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

function readAccountSectionLink(account: Readonly<Account>): To {
  const searchParams = writeSelectedAccount({
    searchParams: new URLSearchParams(),
    accountId: account.id,
  });
  const accountSectionLink = {
    pathname: ACCOUNT_SECTION_PATHNAMES[account.kind],
    search: (account.status === 'DELETED'
      ? writeDeletedShown(searchParams)
      : searchParams
    ).toString(),
  };
  return accountSectionLink;
}

function readLocationSectionLink(location: Readonly<Location>): LocationLink {
  const searchParams = writeSelectedLocation({
    searchParams: new URLSearchParams(),
    locationId: location.id,
  });
  const locationSectionLink = {
    to: {
      pathname: '/locations',
      search: (location.status === 'DELETED'
        ? writeDeletedShown(searchParams)
        : searchParams
      ).toString(),
    },
    id: readLocationLinkId(location.id),
  };
  return locationSectionLink;
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
  const entryAccountIds = filterQuery.account_ids ?? [];
  const entryLocationIds = filterQuery.location_ids ?? [];
  const isFailed = feed.query.isError && feed.query.data === undefined;
  if (baseCurrency === undefined || isFailed) {
    return null;
  }

  const isSelectedTransactionOfOtherEntry =
    isDetailsShown &&
    selectedTransaction !== undefined &&
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
          feed={feed}
          baseCurrency={baseCurrency}
          transactionTypes={transactionTypes}
          topTransactionId={topTransactionId}
          label={`Transactions of ${name}`}
          selection={isDetailsShown ? 'keysInList' : 'none'}
          omittedAccountIds={entryAccountIds}
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
        <div className={styles['details']}>
          <SelectedTransactionDetails
            baseCurrency={baseCurrency}
            defaultTransactionId={topTransactionId}
            readAccountLink={(account) =>
              entryAccountIds.includes(account.id) ? undefined : readAccountSectionLink(account)
            }
            readLocationLink={(location) =>
              entryLocationIds.includes(location.id) ? undefined : readLocationSectionLink(location)
            }
          />
        </div>
      )}
    </>
  );
}
