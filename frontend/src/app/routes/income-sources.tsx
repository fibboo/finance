import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { CATALOG_FULL_MENU_MIN_WIDTH, CatalogTransactions } from '@/app/catalog-transactions';
import { INCOME_SOURCE_ICON_PATH } from '@/app/income-source-icon';
import { readTransactionsLink } from '@/app/transactions-link';
import { readCatalogInitial } from '@/components/catalog-list/catalog-entry';
import { CatalogFilters } from '@/components/catalog-list/catalog-filters';
import { CatalogList } from '@/components/catalog-list/catalog-list';
import { CatalogRowActions } from '@/components/catalog-list/catalog-row-actions';
import {
  readCatalogDeleteButtonId,
  readNeighbourCatalogRowLinkId,
} from '@/components/catalog-list/catalog-row-focus';
import { readCatalogSearch, writeCatalogSearch } from '@/components/catalog-list/catalog-search';
import { readIsDeletedShown, writeIsDeletedShown } from '@/components/catalog-list/deleted-filter';
import { NoEntries } from '@/components/catalog-list/no-entries';
import { NoMatchingEntries } from '@/components/catalog-list/no-matching-entries';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { accountMutations } from '@/features/accounts/api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import { readCatalogDeleteCopy } from '@/features/accounts/components/catalog-delete-copy';
import { IncomeSourceForm } from '@/features/accounts/components/income-source-form';
import { RestoreForm } from '@/features/accounts/components/restore-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useListedEntry } from '@/hooks/use-listed-entry';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { ApiError } from '@/lib/api-error';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './income-sources.module.css';

export const handle = { fullMenuMinWidth: CATALOG_FULL_MENU_MIN_WIDTH };

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

export function Component() {
  const isDesktop = useIsDesktop();
  const [isCreating, setIsCreating] = useState(false);
  const [focusedIncomeSourceId, setFocusedIncomeSourceId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const listSearchParams = writeSelectedTransaction({ searchParams, transactionId: undefined });
  const search = readCatalogSearch(searchParams);
  const searchField = useSearchField(search);
  const searchTerm = readSearchTerm(search);
  const isDeletedShown = readIsDeletedShown(searchParams);
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
      statuses: isDeletedShown ? ['ACTIVE', 'DELETED'] : ['ACTIVE'],
      ...(searchTerm !== undefined && { search_term: searchTerm }),
    }),
    placeholderData: keepPreviousData,
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched = searchTerm !== undefined && incomeSourcePage?.items.length === 0;
  const hasNoEntries = searchTerm === undefined && incomeSourcePage?.items.length === 0;
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
  const [editedIncomeSource, setEditedIncomeSourceId] = useListedEntry(incomeSourcePage?.items);
  const [confirmedIncomeSource, setConfirmedIncomeSourceId] = useListedEntry(
    incomeSourcePage?.items,
  );
  const [renamedIncomeSource, setRenamedIncomeSourceId] = useListedEntry(
    incomeSourcePage?.items.filter((incomeSource) => incomeSource.status === 'DELETED'),
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
            entityName="income source"
            isDisabled={false}
            onClick={() => {
              setIsCreating(true);
            }}
          />
        </div>
        <CatalogFilters
          segment={undefined}
          isDeletedShown={isDeletedShown}
          onDeletedShownChange={(nextIsDeletedShown) => {
            setSearchParams(
              writeIsDeletedShown({
                searchParams: listSearchParams,
                isDeletedShown: nextIsDeletedShown,
              }),
              { replace: true },
            );
          }}
        />
      </div>
      <div className={styles['incomeSources']}>
        <div className={styles['list']}>
          {isNothingMatched ? (
            <NoMatchingEntries
              entityNames="income sources"
              onClear={() => {
                searchField.focusAfterClear();
                setSearchParams(
                  writeCatalogSearch({ searchParams: listSearchParams, search: '' }),
                  {
                    replace: true,
                  },
                );
              }}
            />
          ) : hasNoEntries ? (
            <NoEntries
              iconPath={INCOME_SOURCE_ICON_PATH}
              title="No income sources yet"
              text="Add where your money comes from, like a salary or a client."
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
                      readEntryLink: (incomeSourceId) => ({
                        search: writeSelectedAccount({
                          searchParams: listSearchParams,
                          accountId: incomeSourceId,
                        }).toString(),
                      }),
                      readEntryLinkId: readAccountLinkId,
                    }
                  : undefined
              }
              renderMark={readCatalogInitial}
              renderActions={(incomeSource) => (
                <CatalogRowActions
                  entry={incomeSource}
                  transactionsLink={isDesktop ? undefined : readTransactionsLink(incomeSource)}
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
            transactionsLink={readTransactionsLink(shownIncomeSource)}
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
          title={readCatalogDeleteCopy(confirmedIncomeSource).title}
          text={readCatalogDeleteCopy(confirmedIncomeSource).text}
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
