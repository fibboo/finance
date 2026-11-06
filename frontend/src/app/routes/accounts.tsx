import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavigationType, useLocation, useNavigationType, useSearchParams } from 'react-router';

import { SelectedAccountDetails } from '@/app/selected-account-details';
import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { Sheet } from '@/components/sheet/sheet';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import {
  isAccountSearchTyped,
  readAccountSearch,
  readAccountSearchTerm,
  TYPED_SEARCH_STATE,
  writeAccountSearch,
} from '@/features/accounts/api/account-search';
import { AccountGroups } from '@/features/accounts/components/account-groups';
import { AccountSearch } from '@/features/accounts/components/account-search';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { NoMatchingAccounts } from '@/features/accounts/components/no-matching-accounts';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './accounts.module.css';

const NEW_ACCOUNT_ICON_PATH = 'M12 5v14M5 12h14';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const search = readAccountSearch(searchParams);
  const [searchField, setSearchField] = useState({
    locationKey: location.key,
    search,
    version: 0,
    isFocusedOnMount: false,
  });
  const [isSearchClearPending, setIsSearchClearPending] = useState(false);
  if (location.key !== searchField.locationKey) {
    const isTyped = navigationType !== NavigationType.Pop && isAccountSearchTyped(location.state);
    const isFieldReset = !isTyped && search !== searchField.search;
    setSearchField({
      locationKey: location.key,
      search,
      version: isFieldReset ? searchField.version + 1 : searchField.version,
      isFocusedOnMount: isFieldReset && isSearchClearPending,
    });
    if (isFieldReset) {
      setIsSearchClearPending(false);
    }
  }
  const searchTerm = readAccountSearchTerm(search);
  const accountQuery = { size: ACCOUNT_PAGE_SIZE, kinds: [...MONEY_ACCOUNT_KINDS] };
  const { data: allAccountPage } = useQuery({
    ...accountQueries.list(accountQuery),
    throwOnError: true,
  });
  const { data: accountPage } = useQuery({
    ...accountQueries.list(
      searchTerm === undefined ? accountQuery : { ...accountQuery, search_term: searchTerm },
    ),
    placeholderData: keepPreviousData,
    throwOnError: true,
  });
  const isNothingMatched = searchTerm !== undefined && accountPage?.items.length === 0;
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());

  function closeForm() {
    setIsCreating(false);
  }

  return (
    <Page title="Accounts" count={readAccountCount(allAccountPage?.total)}>
      <div className={styles['actions']}>
        <AccountSearch
          key={searchField.version}
          term={search}
          isFocusedOnMount={searchField.isFocusedOnMount}
          onSearch={(nextSearch) => {
            setSearchParams(writeAccountSearch({ searchParams, search: nextSearch }), {
              replace: true,
              state: TYPED_SEARCH_STATE,
            });
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
                setIsSearchClearPending(true);
                setSearchParams(writeAccountSearch({ searchParams, search: '' }), {
                  replace: true,
                });
              }}
            />
          ) : (
            <AccountGroups accounts={accountPage?.items} baseCurrency={baseCurrency} />
          )}
          <SelectedAccountDetails baseCurrency={baseCurrency} />
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
