import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  CATALOG_DESCRIPTION_SEPARATOR,
  CATALOG_FULL_MENU_MIN_WIDTH,
  CatalogTransactions,
} from '@/app/catalog-transactions';
import { SelectedAccountDetails } from '@/app/selected-account-details';
import { readTransactionsLink } from '@/app/transactions-link';
import { useBaseCurrency } from '@/app/use-base-currency';
import { readCatalogSearch, writeCatalogSearch } from '@/components/catalog-list/catalog-search';
import { NoMatchingEntries } from '@/components/catalog-list/no-matching-entries';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { ACCOUNT_SEARCH_FIELD_ID } from '@/features/accounts/api/account-search';
import { readSelectedAccountId } from '@/features/accounts/api/selected-account';
import { readTopAccountId } from '@/features/accounts/components/account-grouping';
import { AccountGroups } from '@/features/accounts/components/account-groups';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { currencyQueries } from '@/features/currencies/api/currency-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import { useIsWideDesktop } from '@/hooks/use-is-desktop';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './accounts.module.css';

export const handle = { fullMenuMinWidth: CATALOG_FULL_MENU_MIN_WIDTH };

function readAccountCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const accountCount =
    total === undefined ? undefined : { value: total, label: total === 1 ? 'account' : 'accounts' };
  return accountCount;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const isWideDesktop = useIsWideDesktop();
  const [isCreating, setIsCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const listSearchParams = writeSelectedTransaction({ searchParams, transactionId: undefined });
  const search = readCatalogSearch(searchParams);
  const searchField = useSearchField(search);
  const searchTerm = readSearchTerm(search);
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
  const listedAccounts = isNothingMatched ? [] : (accountPage?.items ?? []);
  const selectedAccountId = readSelectedAccountId(searchParams);
  const chosenAccount = listedAccounts.find((account) => account.id === selectedAccountId);
  const shownAccount =
    chosenAccount ?? listedAccounts.find((account) => account.id === topAccountId);
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  const { data: currencies } = useQuery(currencyQueries.recentUse());

  function closeForm() {
    setIsCreating(false);
  }

  return (
    <Page title="Accounts" count={readAccountCount(allAccountPage?.total)}>
      <div className={styles['actions']}>
        <SearchField
          key={searchField.fieldKey}
          id={ACCOUNT_SEARCH_FIELD_ID}
          label="Search accounts"
          term={search}
          isFocusedOnMount={searchField.isFocusedOnMount}
          onSearch={(nextSearch) => {
            setSearchParams(
              writeCatalogSearch({ searchParams: listSearchParams, search: nextSearch }),
              {
                replace: true,
                state: TYPED_SEARCH_STATE,
              },
            );
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
        <div className={isWideDesktop ? styles['accountsWithTransactions'] : styles['accounts']}>
          <div className={isWideDesktop ? styles['list'] : styles['plainList']}>
            {isNothingMatched ? (
              <NoMatchingEntries
                entityNames="accounts"
                onClear={() => {
                  searchField.focusAfterClear();
                  setSearchParams(
                    writeCatalogSearch({ searchParams: listSearchParams, search: '' }),
                    { replace: true },
                  );
                }}
              />
            ) : (
              <AccountGroups
                accounts={accountPage?.items}
                topAccountId={topAccountId}
                baseCurrency={baseCurrency}
                listSearchParams={listSearchParams}
                isParamIgnored={isWideDesktop && chosenAccount === undefined}
              />
            )}
          </div>
          {isWideDesktop ? (
            shownAccount !== undefined && (
              <CatalogTransactions
                key={shownAccount.id}
                name={shownAccount.name}
                description={[
                  dictionaries?.account_kinds.find((kind) => kind.key === shownAccount.kind)?.label,
                  shownAccount.currency ?? baseCurrency,
                  'recent transactions',
                ]
                  .filter((part) => part !== undefined)
                  .join(CATALOG_DESCRIPTION_SEPARATOR)}
                emptyText="No transactions in this account yet"
                filterQuery={{ account_ids: [shownAccount.id] }}
                transactionsLink={readTransactionsLink(shownAccount)}
                transactionTypes={dictionaries?.transaction_types}
                summary={
                  <SelectedAccountDetails
                    form="summary"
                    baseCurrency={baseCurrency}
                    accountCount={allAccountPage?.total}
                    defaultAccountId={shownAccount.id}
                    isKeptOpenOnDesktop
                    isParamIgnored={chosenAccount === undefined}
                    isMoneyAccountOnly
                  />
                }
              />
            )
          ) : (
            <SelectedAccountDetails
              form="panel"
              baseCurrency={baseCurrency}
              accountCount={allAccountPage?.total}
              defaultAccountId={topAccountId}
              isKeptOpenOnDesktop
              isParamIgnored={false}
              isMoneyAccountOnly
            />
          )}
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
