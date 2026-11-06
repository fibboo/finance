import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { Sheet } from '@/components/sheet/sheet';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { AccountGroups } from '@/features/accounts/components/account-groups';
import { AccountSearch } from '@/features/accounts/components/account-search';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { NoMatchingAccounts } from '@/features/accounts/components/no-matching-accounts';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './accounts.module.css';

const NEW_ACCOUNT_ICON_PATH = 'M12 5v14M5 12h14';
const SEARCH_PARAM = 'search';
const SEARCH_TERM_MIN_LENGTH = 3;

function readSearch(searchParams: URLSearchParams): string {
  const search = z
    .string()
    .catch('')
    .parse(searchParams.get(SEARCH_PARAM) ?? '');
  return search;
}

function readSearchTerm(search: string): string | undefined {
  const term = search.trim();
  const searchTerm = term.length >= SEARCH_TERM_MIN_LENGTH ? term : undefined;
  return searchTerm;
}

function writeSearch({
  searchParams,
  search,
}: Readonly<{ searchParams: URLSearchParams; search: string }>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (search === '') {
    nextSearchParams.delete(SEARCH_PARAM);
  } else {
    nextSearchParams.set(SEARCH_PARAM, search);
  }

  return nextSearchParams;
}

function readAccountCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const accountCount =
    total === undefined ? undefined : { value: total, label: total === 1 ? 'account' : 'accounts' };
  return accountCount;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const [isCreating, setIsCreating] = useState(false);
  const [searchFieldKey, setSearchFieldKey] = useState(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = readSearch(searchParams);
  const searchTerm = readSearchTerm(search);
  const accountQuery = { size: ACCOUNT_PAGE_SIZE, kinds: [...MONEY_ACCOUNT_KINDS] };
  const { data: allAccountPage } = useQuery({
    ...accountQueries.list(accountQuery),
    throwOnError: true,
  });
  const { data: accountPage, isPlaceholderData } = useQuery({
    ...accountQueries.list(
      searchTerm === undefined ? accountQuery : { ...accountQuery, search_term: searchTerm },
    ),
    placeholderData: keepPreviousData,
    throwOnError: true,
  });
  const isNothingMatched =
    searchTerm !== undefined && !isPlaceholderData && accountPage?.items.length === 0;
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());

  function closeForm() {
    setIsCreating(false);
  }

  async function changeSearch(nextSearch: string) {
    const nextSearchParams = writeSearch({ searchParams, search: nextSearch });
    await navigate({ search: nextSearchParams.toString() }, { replace: true });
  }

  async function clearSearch() {
    await changeSearch('');
    setSearchFieldKey((key) => key + 1);
  }

  return (
    <Page title="Accounts" count={readAccountCount(allAccountPage?.total)}>
      <div className={styles['actions']}>
        <AccountSearch
          key={searchFieldKey}
          term={search}
          onSearch={(nextSearch) => {
            void changeSearch(nextSearch);
          }}
        />
        <button
          type="button"
          className={styles['newAccount']}
          disabled={dictionaries === undefined || baseCurrency === undefined}
          onClick={() => {
            setIsCreating(true);
          }}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={NEW_ACCOUNT_ICON_PATH} />
          </svg>
          New <span className="visually-hidden-on-phone">account</span>
        </button>
      </div>
      {baseCurrency !== undefined && (
        <div className={styles['accounts']}>
          {isNothingMatched ? (
            <NoMatchingAccounts
              onClear={() => {
                void clearSearch();
              }}
            />
          ) : (
            <AccountGroups accounts={accountPage?.items} baseCurrency={baseCurrency} />
          )}
        </div>
      )}
      {isCreating && dictionaries !== undefined && baseCurrency !== undefined && (
        <Sheet label="New account" onClose={closeForm}>
          <MoneyAccountForm
            name=""
            accountKinds={dictionaries.account_kinds}
            currencies={dictionaries.currencies}
            baseCurrency={baseCurrency}
            onCreated={closeForm}
            onBack={closeForm}
          />
        </Sheet>
      )}
    </Page>
  );
}
