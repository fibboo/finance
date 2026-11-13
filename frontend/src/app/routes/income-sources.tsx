import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type To, useSearchParams } from 'react-router';

import { CatalogTransactions } from '@/app/catalog-transactions';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { accountMutations } from '@/features/accounts/api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { readAccountSearch, writeAccountSearch } from '@/features/accounts/api/account-search';
import { readCatalogFilters, writeCatalogFilters } from '@/features/accounts/api/catalog-filters';
import {
  readCatalogDeleteButtonId,
  readNeighbourCatalogRowLinkId,
} from '@/features/accounts/api/catalog-row-focus';
import { readSelectedAccountId } from '@/features/accounts/api/selected-account';
import { CatalogFilters } from '@/features/accounts/components/catalog-filters';
import { CatalogList } from '@/features/accounts/components/catalog-list';
import { CatalogRowActions } from '@/features/accounts/components/catalog-row-actions';
import { IncomeSourceForm } from '@/features/accounts/components/income-source-form';
import { NoMatchingAccounts } from '@/features/accounts/components/no-matching-accounts';
import { RestoreForm } from '@/features/accounts/components/restore-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { ApiError } from '@/lib/api-error';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './income-sources.module.css';

const INCOME_SOURCE_SEARCH_FIELD_ID = 'income-source-search';
const INCOME_SOURCE_GROUP_KEY = 'INCOME';

function readIncomeSourceCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const incomeSourceCount =
    total === undefined
      ? undefined
      : { value: total, label: total === 1 ? 'income source' : 'income sources' };
  return incomeSourceCount;
}

function readIncomeSourceTransactionsLink(incomeSourceId: string): To {
  const transactionsLink = {
    pathname: '/transactions',
    search: writeTransactionFilters({
      transaction_types: [],
      account_ids: [],
      category_ids: [],
      income_source_ids: [incomeSourceId],
    }).toString(),
  };
  return transactionsLink;
}

export function Component() {
  const isDesktop = useIsDesktop();
  const [isCreating, setIsCreating] = useState(false);
  const [editedIncomeSourceId, setEditedIncomeSourceId] = useState<string | undefined>(undefined);
  const [confirmedIncomeSourceId, setConfirmedIncomeSourceId] = useState<string | undefined>(
    undefined,
  );
  const [renamedIncomeSourceId, setRenamedIncomeSourceId] = useState<string | undefined>(undefined);
  const [focusedIncomeSourceId, setFocusedIncomeSourceId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = readAccountSearch(searchParams);
  const searchField = useSearchField(search);
  const searchTerm = readSearchTerm(search);
  const filters = readCatalogFilters({ searchParams, categoryTypes: undefined });
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const { data: activeIncomeSourcePage } = useQuery({
    ...accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: ['INCOME'], order: 'recent_use' }),
    throwOnError: isThrownWithoutData,
  });
  const { data: incomeSourcePage } = useQuery({
    ...accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: ['INCOME'],
      order: 'recent_use',
      statuses: filters.isDeletedShown ? ['ACTIVE', 'DELETED'] : ['ACTIVE'],
      ...(searchTerm !== undefined && { search_term: searchTerm }),
    }),
    placeholderData: keepPreviousData,
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched = searchTerm !== undefined && incomeSourcePage?.items.length === 0;
  const groups =
    incomeSourcePage === undefined || isNothingMatched
      ? undefined
      : [{ key: INCOME_SOURCE_GROUP_KEY, heading: undefined, entries: incomeSourcePage.items }];
  const selectedIncomeSourceId = readSelectedAccountId(searchParams);
  const chosenIncomeSource = incomeSourcePage?.items.find(
    (incomeSource) => incomeSource.id === selectedIncomeSourceId,
  );
  const shownIncomeSource =
    chosenIncomeSource ?? (isNothingMatched ? undefined : incomeSourcePage?.items[0]);
  const editedIncomeSource = incomeSourcePage?.items.find(
    (incomeSource) => incomeSource.id === editedIncomeSourceId,
  );
  const confirmedIncomeSource = incomeSourcePage?.items.find(
    (incomeSource) => incomeSource.id === confirmedIncomeSourceId,
  );
  const renamedIncomeSource = incomeSourcePage?.items.find(
    (incomeSource) =>
      incomeSource.id === renamedIncomeSourceId && incomeSource.status === 'DELETED',
  );
  const relatedQueryKeys = [
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
  ];
  const incomeSourceDelete = useMutation(accountMutations.delete(relatedQueryKeys));
  const incomeSourceRestore = useMutation(accountMutations.restore(relatedQueryKeys));

  function closeForm() {
    setIsCreating(false);
  }

  function closeEditForm() {
    setEditedIncomeSourceId(undefined);
  }

  function closeRestoreForm() {
    setRenamedIncomeSourceId(undefined);
  }

  function closeConfirmation(incomeSourceId: string) {
    setConfirmedIncomeSourceId(undefined);
    document.getElementById(readCatalogDeleteButtonId(incomeSourceId))?.focus();
  }

  return (
    <Page title="Income sources" count={readIncomeSourceCount(activeIncomeSourcePage?.total)}>
      <div className={styles['controls']}>
        <div className={styles['actions']}>
          <SearchField
            key={searchField.fieldKey}
            id={INCOME_SOURCE_SEARCH_FIELD_ID}
            label="Search income sources"
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
            entityName="income source"
            isDisabled={false}
            onClick={() => {
              setIsCreating(true);
            }}
          />
        </div>
        <CatalogFilters
          categoryTypes={undefined}
          filters={filters}
          onChange={(nextFilters) => {
            setSearchParams(writeCatalogFilters({ searchParams, filters: nextFilters }), {
              replace: true,
            });
          }}
        />
      </div>
      <div className={styles['incomeSources']}>
        <div className={styles['list']}>
          {isNothingMatched ? (
            <NoMatchingAccounts
              entityNames="income sources"
              onClear={() => {
                searchField.focusAfterClear();
                setSearchParams(writeAccountSearch({ searchParams, search: '' }), {
                  replace: true,
                });
              }}
            />
          ) : (
            <CatalogList
              label="Income sources"
              groups={groups}
              selection={
                isDesktop
                  ? {
                      chosenEntryId: chosenIncomeSource?.id,
                      defaultEntryId: shownIncomeSource?.id,
                    }
                  : undefined
              }
              renderActions={(incomeSource) => (
                <CatalogRowActions
                  entry={incomeSource}
                  transactionsLink={readIncomeSourceTransactionsLink(incomeSource.id)}
                  isRestorePending={incomeSourceRestore.isPending}
                  isFocusRequested={incomeSource.id === focusedIncomeSourceId}
                  onFocused={() => {
                    setFocusedIncomeSourceId(undefined);
                  }}
                  onEdit={() => {
                    setEditedIncomeSourceId(incomeSource.id);
                  }}
                  onDelete={() => {
                    setConfirmedIncomeSourceId(incomeSource.id);
                  }}
                  onRestore={() => {
                    incomeSourceRestore.mutate(
                      { account_id: incomeSource.id },
                      {
                        onSuccess: () => {
                          setFocusedIncomeSourceId(incomeSource.id);
                        },
                        onError: (error) => {
                          if (
                            error instanceof ApiError &&
                            error.error_code === 'NAME_ALREADY_EXISTS'
                          ) {
                            setRenamedIncomeSourceId(incomeSource.id);
                          }
                        },
                      },
                    );
                  }}
                />
              )}
            />
          )}
        </div>
        {isDesktop && shownIncomeSource !== undefined && (
          <CatalogTransactions
            key={shownIncomeSource.id}
            name={shownIncomeSource.name}
            description="Income source · recent transactions"
            emptyText="No transactions from this income source yet"
            filterQuery={{ account_ids: [shownIncomeSource.id] }}
            transactionsLink={readIncomeSourceTransactionsLink(shownIncomeSource.id)}
            transactionTypes={dictionaries?.transaction_types}
          />
        )}
      </div>
      {isCreating && (
        <Sheet label="New income source" onClose={closeForm}>
          <IncomeSourceForm
            mode={{ kind: 'create', name: '', onCreated: closeForm }}
            onBack={closeForm}
          />
        </Sheet>
      )}
      {editedIncomeSource !== undefined && (
        <Sheet label="Edit income source" onClose={closeEditForm}>
          <IncomeSourceForm
            mode={{
              kind: 'edit',
              incomeSource: editedIncomeSource,
              relatedQueryKeys,
              onSaved: () => {
                setEditedIncomeSourceId((openIncomeSourceId) =>
                  openIncomeSourceId === editedIncomeSource.id ? undefined : openIncomeSourceId,
                );
              },
            }}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
      {renamedIncomeSource !== undefined && (
        <Sheet label="Restore income source" onClose={closeRestoreForm}>
          <RestoreForm
            account={renamedIncomeSource}
            entityName="income source"
            relatedQueryKeys={relatedQueryKeys}
            onRestored={() => {
              closeRestoreForm();
              setFocusedIncomeSourceId(renamedIncomeSource.id);
            }}
            onBack={closeRestoreForm}
          />
        </Sheet>
      )}
      {confirmedIncomeSource !== undefined && (
        <DeleteConfirmation
          title="Delete this income source?"
          text={`${confirmedIncomeSource.name}. It leaves your income sources and the pickers, and its past transactions keep showing it.`}
          isPending={incomeSourceDelete.isPending}
          onCancel={() => {
            closeConfirmation(confirmedIncomeSource.id);
          }}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourCatalogRowLinkId(confirmedIncomeSource.id);
            incomeSourceDelete.mutate(confirmedIncomeSource.id, {
              onSuccess: () => {
                setConfirmedIncomeSourceId(undefined);
                document.getElementById(neighbourLinkId ?? INCOME_SOURCE_SEARCH_FIELD_ID)?.focus();
              },
              onError: () => {
                closeConfirmation(confirmedIncomeSource.id);
                setFocusedIncomeSourceId(confirmedIncomeSource.id);
              },
            });
          }}
        />
      )}
    </Page>
  );
}
