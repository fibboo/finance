import { queryOptions, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { DetailsColumn } from '@/app/details-column';
import { useBaseCurrency } from '@/app/use-base-currency';
import { useOpenNewTransaction } from '@/app/use-open-new-transaction';
import { useShownAccount } from '@/app/use-shown-account';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { writeSelectedAccount } from '@/features/accounts/api/selected-account';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import {
  hasAccountIdParams,
  hasNarrowingFilters,
  isSortedByDate,
  readTransactionFilterQuery,
  readTransactionFilters,
  readTransactionListKey,
  readTransactionSearch,
  type TransactionFilters,
  writeTransactionFilters,
  writeTransactionSearch,
} from '@/features/transactions/api/transaction-filters';
import { FilterChips } from '@/features/transactions/components/filter-chips';
import { readTopTransactionId } from '@/features/transactions/components/feed-transactions';
import { NoMatchingTransactions } from '@/features/transactions/components/no-matching-transactions';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useDateJump } from '@/features/transactions/hooks/use-date-jump';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { useToday } from '@/hooks/use-today';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { isThrownWithoutData } from '@/lib/query-meta';

import styles from './transactions.module.css';

type AccountKind = components['schemas']['AccountKind'];

function readTransactionCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const transactionCount =
    total === undefined
      ? undefined
      : { value: total, label: total === 1 ? 'transaction' : 'transactions' };
  return transactionCount;
}

function readAccountsQuery(kinds: readonly AccountKind[]) {
  const accountsQuery = queryOptions({
    ...accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: [...kinds], order: 'recent_use' }),
    throwOnError: isThrownWithoutData,
  });
  return accountsQuery;
}

function readJumpDate({
  date,
  filters,
}: Readonly<{ date: string; filters: TransactionFilters }>): string {
  const jumpDate =
    filters.date_from !== undefined && date < filters.date_from ? filters.date_from : date;
  return jumpDate;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const today = useToday();
  const [searchParams, setSearchParams] = useSearchParams();
  const listSearchParams = writeSelectedAccount({
    searchParams: writeSelectedTransaction({ searchParams, transactionId: undefined }),
    accountId: undefined,
  });
  const listKey = readTransactionListKey(listSearchParams);
  const search = readTransactionSearch(searchParams);
  const searchField = useSearchField(search);
  const openNewTransaction = useOpenNewTransaction();
  const { anchorDate, jumpToDate, clearJump } = useDateJump(listKey);
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const { data: moneyAccounts } = useQuery(readAccountsQuery(MONEY_ACCOUNT_KINDS));
  const { data: categories } = useQuery(readAccountsQuery(['EXPENSE']));
  const { data: incomeSources } = useQuery(readAccountsQuery(['INCOME']));
  const accounts =
    moneyAccounts === undefined || categories === undefined || incomeSources === undefined
      ? undefined
      : {
          account_ids: moneyAccounts.items,
          category_ids: categories.items,
          income_source_ids: incomeSources.items,
        };
  const filters =
    dictionaries === undefined || (accounts === undefined && hasAccountIdParams(searchParams))
      ? undefined
      : readTransactionFilters({
          searchParams,
          orders: dictionaries.transaction_orders,
          accounts,
          today,
        });
  const feed = useTransactionFeed({
    isOpeningDayKept: true,
    isFirstPageErrorThrown: true,
    filterQuery: filters === undefined ? undefined : readTransactionFilterQuery(filters),
    anchorDate,
  });
  const topTransactionId = readTopTransactionId(feed);
  const shownAccount = useShownAccount({
    defaultTransactionId: topTransactionId,
    firstAccountId: undefined,
  });
  return (
    <Page title="Transactions" count={readTransactionCount(feed.total)}>
      <div className={styles['actions']}>
        <SearchField
          key={searchField.fieldKey}
          id="transaction-search"
          label="Search transactions"
          term={search}
          isFocusedOnMount={searchField.isFocusedOnMount}
          onSearch={(nextSearch) => {
            setSearchParams(
              writeTransactionSearch({ searchParams: listSearchParams, search: nextSearch }),
              { replace: true, state: TYPED_SEARCH_STATE },
            );
          }}
        />
        <NewButton entityName="transaction" isDisabled={false} onClick={openNewTransaction} />
      </div>
      {baseCurrency !== undefined &&
        dictionaries !== undefined &&
        accounts !== undefined &&
        filters !== undefined && (
          <FilterChips
            filters={filters}
            today={today}
            anchorDate={anchorDate}
            baseCurrency={baseCurrency}
            transactionTypes={dictionaries.transaction_types}
            transactionOrders={dictionaries.transaction_orders}
            accounts={accounts}
            onApply={(change, jumpDate) => {
              const nextFilters = { ...filters, ...change };
              const nextSearchParams = writeTransactionFilters(nextFilters);
              setSearchParams(nextSearchParams);
              if (jumpDate === undefined) {
                clearJump();
              } else {
                jumpToDate({
                  date: readJumpDate({ date: jumpDate, filters: nextFilters }),
                  listKey: readTransactionListKey(nextSearchParams),
                });
              }
            }}
            onJump={(monthEnd) => {
              jumpToDate({ date: readJumpDate({ date: monthEnd, filters }), listKey });
            }}
          />
        )}
      <div className={styles['transactions']}>
        {baseCurrency !== undefined && (
          <TransactionFeed
            key={`${listKey}#${feed.anchorDate ?? ''}`}
            feed={feed}
            baseCurrency={baseCurrency}
            transactionTypes={dictionaries?.transaction_types}
            topTransactionId={topTransactionId}
            label="Transactions"
            isGroupedByDay={filters === undefined || isSortedByDate(filters)}
            onReturnToToday={clearJump}
            {...(filters !== undefined &&
              hasNarrowingFilters(filters) && {
                emptyState: (
                  <NoMatchingTransactions
                    onReset={() => {
                      clearJump();
                      searchField.focusAfterClear();
                      setSearchParams({});
                    }}
                  />
                ),
              })}
          />
        )}
        {baseCurrency !== undefined && (
          <div className={styles['details']}>
            <DetailsColumn
              baseCurrency={baseCurrency}
              defaultTransactionId={topTransactionId}
              shownAccount={shownAccount}
              accountCount={moneyAccounts?.total}
              isAccountFirst={false}
            />
          </div>
        )}
      </div>
    </Page>
  );
}
