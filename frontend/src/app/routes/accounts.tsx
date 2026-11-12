import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavigationType, useLocation, useNavigationType, useSearchParams } from 'react-router';

import { SelectedAccountDetails } from '@/app/selected-account-details';
import { useBaseCurrency } from '@/app/use-base-currency';
import { NewButton } from '@/components/new-button/new-button';
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
import { readTopAccountId } from '@/features/accounts/components/account-grouping';
import { AccountGroups } from '@/features/accounts/components/account-groups';
import { AccountSearch } from '@/features/accounts/components/account-search';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { NoMatchingAccounts } from '@/features/accounts/components/no-matching-accounts';
import { currencyQueries } from '@/features/currencies/api/currency-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { isThrownWithoutData } from '@/lib/query-meta';

import styles from './accounts.module.css';

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
  const accountQuery = {
    size: ACCOUNT_PAGE_SIZE,
    kinds: [...MONEY_ACCOUNT_KINDS],
    order: 'recent_use' as const,
  };
  const { data: allAccountPage } = useQuery({
    ...accountQueries.list(accountQuery),
    throwOnError: isThrownWithoutData,
  });
  const { data: accountPage } = useQuery({
    ...accountQueries.list(
      searchTerm === undefined ? accountQuery : { ...accountQuery, search_term: searchTerm },
    ),
    placeholderData: keepPreviousData,
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched = searchTerm !== undefined && accountPage?.items.length === 0;
  const topAccountId = isNothingMatched ? undefined : readTopAccountId(accountPage?.items ?? []);
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  const { data: currencies } = useQuery(currencyQueries.recentUse());

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
        <NewButton
          entityName="account"
          isDisabled={
            dictionaries === undefined || currencies === undefined || baseCurrency === undefined
          }
          onClick={() => {
            setIsCreating(true);
          }}
        />
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
            <AccountGroups
              accounts={accountPage?.items}
              topAccountId={topAccountId}
              baseCurrency={baseCurrency}
            />
          )}
          <SelectedAccountDetails
            baseCurrency={baseCurrency}
            accountCount={allAccountPage?.total}
            defaultAccountId={topAccountId}
            isKeptOpenOnDesktop
            isParamIgnored={false}
          />
        </div>
      )}
      {isCreating &&
        dictionaries !== undefined &&
        currencies !== undefined &&
        baseCurrency !== undefined && (
          <Sheet label="New account" onClose={closeForm}>
            <MoneyAccountForm
              mode={{ kind: 'create', name: '', onCreated: closeForm }}
              accountKinds={dictionaries.account_kinds}
              currencies={currencies}
              baseCurrency={baseCurrency}
              onBack={closeForm}
            />
          </Sheet>
        )}
    </Page>
  );
}
