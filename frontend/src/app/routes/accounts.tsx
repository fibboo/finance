import { useQuery } from '@tanstack/react-query';
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
import { CatalogFilters } from '@/components/catalog-list/catalog-filters';
import { readCatalogSearch, writeCatalogSearch } from '@/components/catalog-list/catalog-search';
import { NoMatchingEntries } from '@/components/catalog-list/no-matching-entries';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { ACCOUNT_SEARCH_FIELD_ID } from '@/features/accounts/api/account-search';
import {
  readClassificationFilter,
  writeClassificationFilter,
} from '@/features/accounts/api/category-type-filter';
import { classificationQueries } from '@/features/accounts/api/classification-queries';
import { readSelectedAccountId } from '@/features/accounts/api/selected-account';
import { AccountGroups } from '@/features/accounts/components/account-groups';
import { ClassificationSettings } from '@/features/accounts/components/classification-settings';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { currencyQueries } from '@/features/currencies/api/currency-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import { useIsWideDesktop } from '@/hooks/use-is-desktop';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { readClassificationLabel } from '@/lib/classification-label';
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
  const { data: classifications } = useQuery(classificationQueries.list('MONEY_ACCOUNT'));
  const hasTypeFilters = classifications !== undefined && classifications.length > 1;
  const classificationId = readClassificationFilter({
    searchParams,
    param: 'account_type',
    classifications,
  });
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
    ...accountQueries.list({
      ...accountQuery,
      ...(searchTerm !== undefined && { search_term: searchTerm }),
      ...(classificationId !== undefined && { classification_ids: [classificationId] }),
    }),
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched =
    (searchTerm !== undefined || classificationId !== undefined) && accountPage?.items.length === 0;
  const topAccountId = accountPage?.items[0]?.id;
  const listedAccounts = isNothingMatched ? [] : (accountPage?.items ?? []);
  const selectedAccountId = readSelectedAccountId(searchParams);
  const chosenAccount = listedAccounts.find((account) => account.id === selectedAccountId);
  const shownAccount =
    chosenAccount ?? listedAccounts.find((account) => account.id === topAccountId);
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  const { data: currencies } = useQuery(currencyQueries.recentUse());

  function selectClassification(nextClassificationId: string | undefined) {
    setSearchParams(
      writeClassificationFilter({
        searchParams: listSearchParams,
        param: 'account_type',
        classificationId: nextClassificationId,
      }),
      { replace: true },
    );
  }

  function closeForm() {
    setIsCreating(false);
  }

  return (
    <Page
      title="Accounts"
      count={readAccountCount(allAccountPage?.total)}
      actions={
        <>
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
            isDisabled={currencies === undefined || baseCurrency === undefined}
            onClick={() => {
              setIsCreating(true);
            }}
          />
          <ClassificationSettings kind="MONEY_ACCOUNT" />
        </>
      }
    >
      {baseCurrency !== undefined && (
        <div className={isWideDesktop ? styles['accountsWithTransactions'] : styles['accounts']}>
          <div className={isWideDesktop ? styles['list'] : styles['plainList']}>
            {hasTypeFilters && (
              <CatalogFilters
                segment={{
                  kind: 'shown',
                  legend: 'Account type',
                  options: classifications.map(({ id, name }) => ({ key: id, label: name })),
                  chosenKey: classificationId,
                  onChoose: selectClassification,
                }}
              />
            )}
            {isNothingMatched ? (
              <NoMatchingEntries
                entityNames="accounts"
                isFiltered={classificationId !== undefined}
                onClear={() => {
                  searchField.focusAfterClear();
                  setSearchParams(
                    writeClassificationFilter({
                      searchParams: writeCatalogSearch({
                        searchParams: listSearchParams,
                        search: '',
                      }),
                      param: 'account_type',
                      classificationId: undefined,
                    }),
                    { replace: true },
                  );
                }}
              />
            ) : (
              <AccountGroups
                accounts={accountPage?.items}
                classifications={classifications}
                hasTypeFilters={hasTypeFilters}
                topAccountId={topAccountId}
                baseCurrency={baseCurrency}
                listSearchParams={listSearchParams}
                isParamIgnored={isWideDesktop && chosenAccount === undefined}
              />
            )}
          </div>
          {isWideDesktop ? (
            (shownAccount !== undefined || accountPage === undefined) && (
              <CatalogTransactions
                entryFeed={
                  shownAccount === undefined
                    ? undefined
                    : {
                        name: shownAccount.name,
                        description: [
                          readClassificationLabel({
                            classifications,
                            classificationId: shownAccount.classification_id,
                          }),
                          shownAccount.currency ?? baseCurrency,
                          'recent transactions',
                        ]
                          .filter((part) => part !== undefined)
                          .join(CATALOG_DESCRIPTION_SEPARATOR),
                        filterQuery: { account_ids: [shownAccount.id] },
                        transactionsLink: readTransactionsLink(shownAccount),
                      }
                }
                emptyText="No transactions in this account yet"
                transactionTypes={dictionaries?.transaction_types}
                summary={
                  <SelectedAccountDetails
                    form="summary"
                    baseCurrency={baseCurrency}
                    accountCount={allAccountPage?.total}
                    shownAccount={{
                      kind: 'selected',
                      defaultAccountId: shownAccount?.id,
                      isDefaultAccountPending: accountPage === undefined,
                      isParamIgnored: chosenAccount === undefined,
                    }}
                    isKeptOpenOnDesktop
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
              shownAccount={{
                kind: 'selected',
                defaultAccountId: topAccountId,
                isDefaultAccountPending: accountPage === undefined,
                isParamIgnored: false,
              }}
              isKeptOpenOnDesktop
              isMoneyAccountOnly
            />
          )}
        </div>
      )}
      {isCreating && currencies !== undefined && baseCurrency !== undefined && (
        <Sheet label="New account" onClose={closeForm}>
          <MoneyAccountForm
            mode={{ kind: 'create', name: '', onCreated: closeForm }}
            currencies={currencies}
            baseCurrency={baseCurrency}
            onBack={closeForm}
          />
        </Sheet>
      )}
    </Page>
  );
}
