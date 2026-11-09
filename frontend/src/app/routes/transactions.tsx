import { queryOptions, useQuery } from '@tanstack/react-query';
import { type To, useSearchParams } from 'react-router';

import { SelectedTransactionDetails } from '@/app/selected-transaction-details';
import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
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
  type TransactionFilters,
  writeTransactionFilters,
} from '@/features/transactions/api/transaction-filters';
import { FilterChips } from '@/features/transactions/components/filter-chips';
import { NoMatchingTransactions } from '@/features/transactions/components/no-matching-transactions';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useDateJump } from '@/features/transactions/hooks/use-date-jump';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
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
    ...accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: [...kinds] }),
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

function readAccountLink(accountId: string): To {
  const accountLink = {
    pathname: '/accounts',
    search: writeSelectedAccount({ searchParams: new URLSearchParams(), accountId }).toString(),
  };
  return accountLink;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const today = useToday();
  const [searchParams, setSearchParams] = useSearchParams();
  const listKey = writeSelectedTransaction({ searchParams, transactionId: undefined }).toString();
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
  return (
    <Page title="Transactions" count={readTransactionCount(feed.total)}>
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
                  listKey: nextSearchParams.toString(),
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
            label="Transactions"
            isGroupedByDay={filters === undefined || isSortedByDate(filters)}
            onReturnToToday={clearJump}
            {...(filters !== undefined &&
              hasNarrowingFilters(filters) && {
                emptyState: (
                  <NoMatchingTransactions
                    onReset={() => {
                      clearJump();
                      setSearchParams({});
                    }}
                  />
                ),
              })}
          />
        )}
        {baseCurrency !== undefined && (
          <SelectedTransactionDetails
            baseCurrency={baseCurrency}
            readAccountLink={readAccountLink}
          />
        )}
      </div>
    </Page>
  );
}
