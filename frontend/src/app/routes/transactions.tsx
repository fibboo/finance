import { queryOptions, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { DetailsColumn, TRANSACTION_FULL_MENU_MIN_WIDTH } from '@/app/details-column';
import { writeSelectedEntry } from '@/app/selected-entry';
import { useAccountOptionChoices } from '@/app/use-account-option-choices';
import { useBaseCurrency } from '@/app/use-base-currency';
import { useOpenNewTransaction } from '@/app/use-open-new-transaction';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { LOCATION_PAGE_SIZE, locationQueries } from '@/features/locations/api/location-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import {
  readAppliedFilterCount,
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
import { FilterPanel } from '@/features/transactions/components/filter-panel';
import {
  FiltersPanel,
  type FiltersPanelHandle,
} from '@/features/transactions/components/filters-panel';
import { FilterSummary } from '@/features/transactions/components/filter-summary';
import { readFilterSummary } from '@/features/transactions/components/filter-labels';
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

export const handle = { fullMenuMinWidth: TRANSACTION_FULL_MENU_MIN_WIDTH };

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
  const filtersPanelRef = useRef<FiltersPanelHandle>(null);
  const [filterResetVersion, setFilterResetVersion] = useState(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const baseCurrency = useBaseCurrency();
  const today = useToday();
  const [searchParams, setSearchParams] = useSearchParams();
  const listSearchParams = writeSelectedEntry({
    searchParams: writeSelectedTransaction({ searchParams, transactionId: undefined }),
    entry: undefined,
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
  const optionChoices = useAccountOptionChoices({
    dictionaries,
    isEnabled: isFiltersOpen,
    hasCategories: true,
  });
  const { data: moneyAccounts } = useQuery(readAccountsQuery(MONEY_ACCOUNT_KINDS));
  const { data: categories } = useQuery(readAccountsQuery(['EXPENSE']));
  const { data: incomeSources } = useQuery(readAccountsQuery(['INCOME']));
  const { data: locations } = useQuery({
    ...locationQueries.list({ size: LOCATION_PAGE_SIZE, order: 'recent_use' }),
    throwOnError: isThrownWithoutData,
  });
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
  const filterItems =
    accounts === undefined || locations === undefined
      ? undefined
      : { ...accounts, location_ids: locations.items };
  const filterSummary =
    baseCurrency !== undefined &&
    dictionaries !== undefined &&
    filters !== undefined &&
    filterItems !== undefined
      ? readFilterSummary({
          filters,
          baseCurrency,
          transactionTypes: dictionaries.transaction_types,
          transactionOrders: dictionaries.transaction_orders,
          items: filterItems,
        })
      : '';

  function resetFilters() {
    setFilterResetVersion((version) => version + 1);
    clearJump();
    setSearchParams(writeTransactionSearch({ searchParams: new URLSearchParams(), search }));
  }

  function applyFilters(change: Partial<TransactionFilters>, jumpDate?: string) {
    if (filters === undefined) {
      return;
    }
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
  }

  return (
    <Page
      title="Transactions"
      count={readTransactionCount(feed.total)}
      actions={
        <>
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
          <FilterPanel
            count={filters === undefined ? 0 : readAppliedFilterCount(filters)}
            isOpen={isFiltersOpen}
            isDisabled={
              baseCurrency === undefined ||
              dictionaries === undefined ||
              filters === undefined ||
              filterItems === undefined
            }
            onOpenChange={setIsFiltersOpen}
            onBeforeClose={() => {
              filtersPanelRef.current?.applyPendingChanges();
            }}
          >
            {(close) =>
              baseCurrency !== undefined &&
              dictionaries !== undefined &&
              filters !== undefined &&
              filterItems !== undefined && (
                <FiltersPanel
                  ref={filtersPanelRef}
                  key={filterResetVersion}
                  filters={filters}
                  today={today}
                  anchorDate={anchorDate}
                  baseCurrency={baseCurrency}
                  dictionaries={dictionaries}
                  optionChoices={optionChoices}
                  items={filterItems}
                  total={feed.total}
                  isTotalPending={feed.total === undefined}
                  onApply={applyFilters}
                  onJump={(monthEnd) => {
                    jumpToDate({ date: readJumpDate({ date: monthEnd, filters }), listKey });
                  }}
                  onReset={resetFilters}
                  onClose={close}
                />
              )
            }
          </FilterPanel>
          <NewButton entityName="transaction" isDisabled={false} onClick={openNewTransaction} />
        </>
      }
    >
      <div className={styles['transactions']}>
        <div className={styles['feed']}>
          {filterSummary !== '' && (
            <FilterSummary
              summary={filterSummary}
              onOpen={() => {
                setIsFiltersOpen(true);
              }}
              onReset={resetFilters}
            />
          )}
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
        </div>
        {baseCurrency !== undefined && (
          <div className={styles['details']}>
            <DetailsColumn
              baseCurrency={baseCurrency}
              defaultTransactionId={topTransactionId}
              isDefaultTransactionPending={feed.query.isPending}
              omittedAccountIds={undefined}
              omittedLocationIds={undefined}
              shownAccount={undefined}
            />
          </div>
        )}
      </div>
    </Page>
  );
}
